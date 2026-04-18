# Implementation plan

Status: Phase 4. Awaiting plan review gate.

## Ordering principle

Backend first (independently testable). Then frontend foundation (types, store, settings, prompts, api client). Then markdown dependency + renderer. Then the orchestration hook. Then UI components. Then the page-level wiring. Each layer leaves the tree compilable.

## Sequence

### Backend

#### 1. Schemas: extend ChatRequest

File: `backend/app/models/schemas.py`

Add:

```python
class ChatRequestSourceSuggestion(BaseModel):
    type: SuggestionType
    preview: str
    reasoning: str = ""

class ChatRequest(BaseModel):
    transcript: list[TranscriptChunk] = Field(default_factory=list)
    messages: list[ChatMessage] = Field(default_factory=list)
    new_message: str = ""
    source_suggestion: ChatRequestSourceSuggestion | None = None  # NEW
    prompt_template: str = ""
```

Complexity: low.
Depends on: nothing.

#### 2. prompt_builder: real build_chat_prompt

File: `backend/app/services/prompt_builder.py`

Replace the stub. New signature returns OpenAI-compatible chat messages:

```python
def build_chat_prompt(
    transcript: list[TranscriptChunk],
    messages: list[ChatMessage],
    new_message: str,
    source_suggestion: ChatRequestSourceSuggestion | None,
    prompt_template: str,
) -> list[dict[str, str]]:
```

Logic:
- `transcript_block = "\n".join(f"[{_format_clock(c.timestamp)}] {c.text}" for c in transcript) or "(no transcript yet)"`
- `system = f"{prompt_template}\n\n[Live meeting transcript]\n{transcript_block}"`
- For each prior `m` in `messages` with `m.content.strip() != ""`: append `{"role": m.role, "content": m.content}`
- Final user content:
  - If `source_suggestion`: `f"Click-through: [{src.type}] {src.preview}\nInternal reasoning: {src.reasoning}\nExplain in depth using the transcript and prior chat as context."`
  - Else: `new_message`
- Return `[{"role": "system", "content": system}, *prior, {"role": "user", "content": final}]`

Complexity: low-medium.
Depends on: step 1.

#### 3. groq_client.stream_chat: real SSE parser

File: `backend/app/services/groq_client.py`

Replace the `NotImplementedError` stub. New signature accepts the assembled messages:

```python
async def stream_chat(
    self, messages: list[dict[str, str]]
) -> AsyncIterator[str]:
```

Logic:
- POST `f"{GROQ_API_BASE}/chat/completions"` with stream=True via `httpx.AsyncClient.stream`.
- Body:
  ```python
  {
    "model": GROQ_CHAT_MODEL,
    "messages": messages,
    "temperature": 0.5,
    "stream": True,
  }
  ```
- Timeout: `CHAT_TIMEOUT_SECONDS` (60s).
- Parse SSE: read line by line; lines starting with `data: ` are JSON frames; `data: [DONE]` terminates.
- For each frame, extract `choices[0].delta.content` if present and non-empty; yield it.
- On HTTP error, raise `httpx.HTTPStatusError` so the route can map.

Implementation sketch:
```python
async with httpx.AsyncClient(timeout=CHAT_TIMEOUT_SECONDS) as client:
    async with client.stream("POST", url, headers=..., json=...) as resp:
        resp.raise_for_status()
        async for raw_line in resp.aiter_lines():
            if not raw_line or not raw_line.startswith("data: "):
                continue
            payload = raw_line[len("data: "):]
            if payload == "[DONE]":
                return
            try:
                frame = json.loads(payload)
            except json.JSONDecodeError:
                continue
            delta = (
                frame.get("choices", [{}])[0]
                .get("delta", {})
                .get("content")
            )
            if delta:
                yield delta
```

Complexity: high. SSE parsing + async streaming + error handling.
Depends on: step 1.

#### 4. /chat route

File: `backend/app/routes/chat.py`

Replace mock entirely. Logic:

- Validate `x-groq-api-key` (401 if empty).
- Validate `prompt_template` non-empty after strip (400 "prompt template is empty").
- Validate that we have something to ask: `new_message.strip()` OR `source_suggestion` (400 "new_message is empty").
- Build `messages` via `build_chat_prompt`.
- Construct `GroqClient`.
- Define an `async def gen()` that:
  - yields each token from `client.stream_chat(messages)` as UTF-8 bytes
  - catches `httpx.HTTPStatusError` (raises HTTPException only if no tokens have flowed; otherwise silently closes)
  - catches `httpx.TimeoutException` (same)
- We cannot raise HTTPException after the response has started streaming. So the simplest pattern: do a "primer" call that wraps the upstream-open phase. Use try/except around the first `aiter_lines()` invocation. If it fails before we yield, raise HTTPException. After the first yield, swallow errors and close.

Cleaner approach: wrap stream_chat into two phases:
- Phase 1 (open + first frame): may raise; map to HTTPException.
- Phase 2 (subsequent frames): on error, just stop yielding.

I will refactor `stream_chat` so it materializes the upstream open inside the generator's first `__anext__`. The route catches and maps the first exception only. Subsequent errors are swallowed.

Implementation: use a small helper that pre-pulls the first token, lets us detect open-time errors early, then yields normally.

```python
async def transcribe_stream() -> AsyncIterator[bytes]:
    iterator = client.stream_chat(messages).__aiter__()
    try:
        first = await iterator.__anext__()
    except StopAsyncIteration:
        return
    except httpx.HTTPStatusError as err:
        raise _map_status_error(err) from err
    except httpx.TimeoutException:
        raise HTTPException(504, "groq timed out") from None
    except httpx.HTTPError:
        raise HTTPException(502, "groq upstream failed") from None
    yield first.encode("utf-8")
    try:
        async for token in iterator:
            yield token.encode("utf-8")
    except Exception:
        # silent close mid-stream; client treats as interrupted
        return
```

Wait — that pattern doesn't quite work because StreamingResponse does NOT propagate raised HTTPExceptions from inside the generator. The headers are already sent.

Pattern that does work: do the priming OUTSIDE the StreamingResponse, then pass an already-opened iterator into the response.

```python
@router.post("/chat")
async def chat(body: ChatRequest, x_groq_api_key: str = Header(default="")):
    # validations omitted for brevity
    messages = build_chat_prompt(...)
    client = GroqClient(x_groq_api_key)
    iterator = client.stream_chat(messages).__aiter__()

    # Prime: try to fetch the first token. Map errors to HTTPException now.
    try:
        first = await iterator.__anext__()
    except StopAsyncIteration:
        first = None
    except httpx.HTTPStatusError as err:
        raise _map_status_error(err) from err
    except httpx.TimeoutException:
        raise HTTPException(504, "groq timed out") from None
    except httpx.HTTPError:
        raise HTTPException(502, "groq upstream failed") from None

    async def gen():
        if first is not None:
            yield first.encode("utf-8")
        try:
            async for token in iterator:
                yield token.encode("utf-8")
        except Exception:
            return

    return StreamingResponse(gen(), media_type="text/plain; charset=utf-8")
```

Caveat: if the upstream Groq client opened a connection, we hold it until `gen()` runs. FastAPI runs the StreamingResponse generator immediately so this is fine. If `gen()` is never iterated (browser tab closed before headers go out), we leak the connection until GC. Acceptable for v1.

Complexity: high.
Depends on: steps 1, 2, 3.

### Frontend foundation

#### 5. Types: extend ChatMessage.sourceSuggestion

File: `frontend/lib/types.ts`

Add optional `reasoning`:

```ts
export type ChatMessage = {
  // existing fields
  sourceSuggestion?: { type: SuggestionType; preview: string; reasoning?: string };
};
```

Backward-compatible.

Complexity: trivial.
Depends on: nothing.

#### 6. Store: chatError + setter

File: `frontend/lib/store.ts`

Add `chatError: ChatError`, setter, include in `initialState` and `reset`.

Complexity: low.
Depends on: nothing.

#### 7. Settings store: v2 migration

File: `frontend/lib/settings-store.ts`

- Remove `detailedAnswerContextMode` from type, defaults.
- Bump `persist.version` from `1` to `2`.
- Migrate function: drop the stale field; fill empty `detailedAnswerPrompt` and `chatPrompt` with current defaults.

```ts
version: 2,
migrate: (persistedState) => {
  const s = (persistedState ?? {}) as Record<string, unknown>;
  delete s.detailedAnswerContextMode;
  if (!s.suggestionPrompt) s.suggestionPrompt = SUGGESTION_PROMPT;
  if (!s.detailedAnswerPrompt) s.detailedAnswerPrompt = DETAILED_ANSWER_PROMPT;
  if (!s.chatPrompt) s.chatPrompt = CHAT_PROMPT;
  if (
    typeof s.suggestionContextChunkCount !== "number" ||
    s.suggestionContextChunkCount < 1
  ) {
    s.suggestionContextChunkCount = defaults.suggestionContextChunkCount;
  }
  return s;
},
```

Complexity: low.
Depends on: step 8 (uses default prompt constants).

#### 8. Prompts: write DETAILED_ANSWER_PROMPT and CHAT_PROMPT

File: `frontend/lib/prompts.ts`

Replace the two empty strings with the v1 content from `prompts.md`.

Complexity: trivial (content paste).
Depends on: nothing.

#### 9. api.ts: extend streamChat

File: `frontend/lib/api.ts`

Add `sourceSuggestion` to args; serialize as `source_suggestion` in body:

```ts
export async function streamChat(args: {
  apiKey: string;
  transcript: TranscriptChunk[];
  messages: ChatMessage[];
  newMessage: string;
  sourceSuggestion: { type: SuggestionType; preview: string; reasoning: string } | null;
  promptTemplate: string;
  onToken: (token: string) => void;
}): Promise<void>
```

Body: include `source_suggestion: args.sourceSuggestion`.

Complexity: low.
Depends on: step 5.

#### 10. SuggestionCard: include reasoning when appending

File: `frontend/components/suggestions/SuggestionCard.tsx`

Update `handleClick` to include `reasoning` in `sourceSuggestion`:

```ts
sourceSuggestion: {
  type: suggestion.type,
  preview: suggestion.preview,
  reasoning: suggestion.reasoning,
},
```

This is what the chat hook will read from the user message and forward to the backend.

Complexity: trivial.
Depends on: step 5.

### Markdown dependency

#### 11. Install react-markdown + remark-gfm

```
cd frontend && npm install react-markdown remark-gfm
```

Pulls in `unified`, `mdast-util-*`, `micromark-*`. Bundle adds ~30 KB gzipped. Acceptable for the take-home.

Complexity: trivial.
Depends on: nothing.

#### 12. AssistantMarkdown component

File: `frontend/components/chat/AssistantMarkdown.tsx`

```tsx
"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = { children: string };

export function AssistantMarkdown({ children }: Props) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      skipHtml
      components={{
        a: ({ href, children: c }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 underline underline-offset-2 hover:text-blue-300"
          >
            {c}
          </a>
        ),
        // Drop visual-asset elements for safety.
        img: () => null,
        // Style basics that match the dark theme.
        p: ({ children: c }) => (
          <p className="mb-2 leading-relaxed last:mb-0">{c}</p>
        ),
        ul: ({ children: c }) => (
          <ul className="mb-2 list-disc pl-6 last:mb-0">{c}</ul>
        ),
        ol: ({ children: c }) => (
          <ol className="mb-2 list-decimal pl-6 last:mb-0">{c}</ol>
        ),
        code: ({ className, children: c }) => {
          const isBlock = (className ?? "").startsWith("language-");
          return isBlock ? (
            <pre className="my-2 overflow-x-auto rounded-md bg-muted p-3 text-xs">
              <code className={className}>{c}</code>
            </pre>
          ) : (
            <code className="rounded bg-muted px-1 py-0.5 text-xs">{c}</code>
          );
        },
        h1: ({ children: c }) => <h1 className="mb-2 text-base font-semibold">{c}</h1>,
        h2: ({ children: c }) => <h2 className="mb-2 text-sm font-semibold">{c}</h2>,
        h3: ({ children: c }) => <h3 className="mb-2 text-sm font-semibold">{c}</h3>,
        h4: ({ children: c }) => <h4 className="mb-2 text-sm font-semibold">{c}</h4>,
        blockquote: ({ children: c }) => (
          <blockquote className="my-2 border-l-2 border-border pl-3 italic">
            {c}
          </blockquote>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
```

Complexity: low-medium.
Depends on: step 11.

### Orchestration hook

#### 13. useChatStream

File: `frontend/hooks/useChatStream.ts`

Subscribe to `chatMessages.length` via Zustand selector. Use refs for `lastHandledIdRef`, `bufferRef`, `flushIntervalRef`, `assistantIdRef`.

Logic outline:

```ts
"use client";

import { useEffect, useRef } from "react";
import { streamChat } from "@/lib/api";
import { useSessionStore } from "@/lib/store";
import { useSettingsStore } from "@/lib/settings-store";

const FLUSH_INTERVAL_MS = 50;

export function useChatStream(): void {
  const lastHandledIdRef = useRef<string | null>(null);
  const bufferRef = useRef<string>("");
  const flushIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const messagesLength = useSessionStore((s) => s.chatMessages.length);

  useEffect(() => {
    void maybeFire();
  }, [messagesLength]);

  async function maybeFire(): Promise<void> {
    const session = useSessionStore.getState();
    if (session.isStreamingChat) return;
    const last = session.chatMessages[session.chatMessages.length - 1];
    if (!last) return;
    if (last.role !== "user") return;
    if (lastHandledIdRef.current === last.id) return;

    lastHandledIdRef.current = last.id;
    await fire(last);

    // Post-stream nudge: another user message may have queued during streaming.
    const after = useSessionStore.getState();
    const newest = after.chatMessages[after.chatMessages.length - 1];
    if (
      newest &&
      newest.role === "user" &&
      newest.id !== lastHandledIdRef.current
    ) {
      void maybeFire();
    }
  }

  async function fire(userMsg: ChatMessage): Promise<void> {
    const session = useSessionStore.getState();
    const settings = useSettingsStore.getState();

    session.setChatError("none");

    const isDetailed = !!userMsg.sourceSuggestion;
    const promptTemplate = isDetailed
      ? settings.detailedAnswerPrompt
      : settings.chatPrompt;
    const apiKey = settings.groqApiKey;

    if (!apiKey || !promptTemplate.trim()) {
      // Fail fast: append empty assistant + interrupted pill.
      const id = crypto.randomUUID();
      session.addChatMessage({
        id,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      });
      session.setChatError("interrupted");
      return;
    }

    const assistantId = crypto.randomUUID();
    session.addChatMessage({
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    });
    session.setStreamingChat(true);

    bufferRef.current = "";
    flushIntervalRef.current = setInterval(() => {
      if (bufferRef.current.length === 0) return;
      const chunk = bufferRef.current;
      bufferRef.current = "";
      useSessionStore.getState().appendChatToken(assistantId, chunk);
    }, FLUSH_INTERVAL_MS);

    try {
      // Send all messages prior to the just-added assistant placeholder.
      const stateAtFire = useSessionStore.getState();
      const priorMessages = stateAtFire.chatMessages.filter(
        (m) => m.id !== assistantId,
      );
      const sourceSuggestion = userMsg.sourceSuggestion
        ? {
            type: userMsg.sourceSuggestion.type,
            preview: userMsg.sourceSuggestion.preview,
            reasoning: userMsg.sourceSuggestion.reasoning ?? "",
          }
        : null;

      await streamChat({
        apiKey,
        transcript: stateAtFire.transcript,
        messages: priorMessages,
        newMessage: userMsg.content,
        sourceSuggestion,
        promptTemplate,
        onToken: (tok) => {
          bufferRef.current += tok;
        },
      });
      flushFinal(assistantId);
    } catch {
      flushFinal(assistantId);
      useSessionStore.getState().setChatError("interrupted");
    } finally {
      if (flushIntervalRef.current) {
        clearInterval(flushIntervalRef.current);
        flushIntervalRef.current = null;
      }
      useSessionStore.getState().setStreamingChat(false);
    }
  }

  function flushFinal(assistantId: string): void {
    if (bufferRef.current.length > 0) {
      const chunk = bufferRef.current;
      bufferRef.current = "";
      useSessionStore.getState().appendChatToken(assistantId, chunk);
    }
  }
}
```

Notes:
- The hook is called once in `page.tsx`. Subscribing via `useSessionStore((s) => s.chatMessages.length)` re-runs the effect on each new message.
- All state reads inside callbacks use `useSessionStore.getState()` to avoid stale closures (Strict Mode safe).
- `lastHandledIdRef` prevents double-fire across Strict Mode and across the post-stream nudge.

Complexity: high.
Depends on: 5, 6, 8, 9.

### UI components

#### 14. ChatInput rewrite

File: `frontend/components/chat/ChatInput.tsx`

```tsx
"use client";

import { useState, type KeyboardEvent } from "react";
import { Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSessionStore } from "@/lib/store";

export function ChatInput() {
  const [draft, setDraft] = useState("");
  const isStreaming = useSessionStore((s) => s.isStreamingChat);

  function submit(): void {
    const text = draft.trim();
    if (!text || isStreaming) return;
    useSessionStore.getState().addChatMessage({
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    });
    setDraft("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex items-end gap-2 border-t border-border p-3">
      <Textarea
        rows={3}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask anything... (Enter to send, Shift+Enter for newline)"
        disabled={isStreaming}
        className="resize-none"
      />
      <Button
        type="button"
        onClick={submit}
        disabled={isStreaming || draft.trim() === ""}
        aria-label={isStreaming ? "Streaming" : "Send"}
      >
        {isStreaming ? <Square className="size-4" /> : <Send className="size-4" />}
      </Button>
    </div>
  );
}
```

Complexity: low.
Depends on: 6.

#### 15. ChatMessage rewrite

File: `frontend/components/chat/ChatMessage.tsx`

Two render paths plus the streaming-cursor / interrupted-pill logic. Props extended to take `isLastStreaming: boolean`.

```tsx
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/lib/store";
import type { ChatMessage as ChatMessageType, SuggestionType } from "@/lib/types";
import { TypeBadge } from "@/components/suggestions/TypeBadge";
import { AssistantMarkdown } from "./AssistantMarkdown";

type Props = {
  message: ChatMessageType;
  isLastStreaming?: boolean;
  showInterruptedPill?: boolean;
};

export function ChatMessage({
  message,
  isLastStreaming = false,
  showInterruptedPill = false,
}: Props) {
  if (message.role === "user") return <UserMessage message={message} />;
  return (
    <AssistantMessage
      message={message}
      isLastStreaming={isLastStreaming}
      showInterruptedPill={showInterruptedPill}
    />
  );
}

function UserMessage({ message }: { message: ChatMessageType }) {
  const sourceType = message.sourceSuggestion?.type;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 text-[10px] tracking-widest text-muted-foreground">
        <span>YOU</span>
        {sourceType && <TypeBadge type={sourceType as SuggestionType} />}
      </div>
      <Card>
        <CardContent className="p-3 text-sm leading-relaxed text-foreground">
          {message.content}
        </CardContent>
      </Card>
    </div>
  );
}

function AssistantMessage({
  message,
  isLastStreaming,
  showInterruptedPill,
}: {
  message: ChatMessageType;
  isLastStreaming: boolean;
  showInterruptedPill: boolean;
}) {
  const isEmpty = message.content.length === 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] tracking-widest text-muted-foreground">
        ASSISTANT
      </div>
      <Card>
        <CardContent className="p-3 text-sm">
          {isEmpty ? (
            <PlaceholderDots />
          ) : (
            <div className="text-foreground">
              <AssistantMarkdown>{message.content}</AssistantMarkdown>
              {isLastStreaming && (
                <span className="ml-0.5 inline-block animate-pulse">▍</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      {showInterruptedPill && (
        <div className="self-start rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] tracking-widest text-destructive">
          Connection interrupted
        </div>
      )}
    </div>
  );
}

function PlaceholderDots() {
  return (
    <div className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            "size-1.5 rounded-full bg-muted-foreground/60 animate-pulse",
          )}
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}
```

Complexity: medium.
Depends on: 5, 6, 12.

#### 16. ChatPanel rewrite

File: `frontend/components/chat/ChatPanel.tsx`

```tsx
"use client";

import { useEffect, useRef } from "react";
import { ColumnHeader } from "@/components/layout/ColumnHeader";
import { Card, CardContent } from "@/components/ui/card";
import { useSessionStore } from "@/lib/store";
import { ChatInput } from "./ChatInput";
import { ChatMessage } from "./ChatMessage";

export function ChatPanel() {
  const messages = useSessionStore((s) => s.chatMessages);
  const isStreaming = useSessionStore((s) => s.isStreamingChat);
  const chatError = useSessionStore((s) => s.chatError);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, isStreaming]);

  const lastIndex = messages.length - 1;
  const lastIsAssistant =
    lastIndex >= 0 && messages[lastIndex].role === "assistant";

  return (
    <div className="flex h-full flex-col">
      <ColumnHeader index={3} title="Chat (Detailed Answers)" right="SESSION-ONLY" />
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 min-h-0">
        {messages.length === 0 ? (
          <Card>
            <CardContent className="p-3 text-xs text-muted-foreground">
              Click a suggestion or type a question below.
            </CardContent>
          </Card>
        ) : (
          messages.map((m, i) => (
            <ChatMessage
              key={m.id}
              message={m}
              isLastStreaming={
                isStreaming && i === lastIndex && lastIsAssistant
              }
              showInterruptedPill={
                chatError === "interrupted" &&
                i === lastIndex &&
                lastIsAssistant
              }
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>
      <ChatInput />
    </div>
  );
}
```

Complexity: medium.
Depends on: 6, 14, 15.

#### 17. page.tsx: wire useChatStream

File: `frontend/app/page.tsx`

Add the hook call alongside `useRecorder`:

```tsx
const recorder = useRecorder();
useChatStream();
```

`useChatStream` returns void; it just sets up the subscription.

Complexity: trivial.
Depends on: 13.

#### 18. Settings page: drop the context-mode select

File: `frontend/app/settings/page.tsx`

Remove the "Detailed answer context" select (and its label). The 3-column grid becomes a 2-column grid (or we collapse to 2 controls per row).

Complexity: trivial.
Depends on: 7.

## Dependency graph

```
1 schemas ──┬─→ 2 prompt_builder ──┐
            └─→ 3 stream_chat ─────┴─→ 4 /chat route

5 types ──┬─→ 6 store
          ├─→ 9 api.ts
          └─→ 10 SuggestionCard reasoning

8 prompts ─→ 7 settings v2

11 npm install ─→ 12 AssistantMarkdown ─→ 15 ChatMessage
                                          ↑
                  13 useChatStream (needs 5,6,8,9) ─→ 17 page.tsx
                                          ↑
                  14 ChatInput (needs 6) ─┤
                                          ↓
                                          16 ChatPanel (needs 6, 14, 15)

7 settings ─→ 18 settings page
```

Safe build order: 1 → 2 → 3 → 4 → 5 → 6 → 8 → 7 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18.

## Commands per layer

After backend (1-4):
```
cd backend && source .venv/bin/activate
ruff check app && mypy app && pytest
```

After frontend foundation (5-10):
```
cd frontend && npm run typecheck && npm run lint
```

After install + markdown (11-12):
```
cd frontend && npm run typecheck && npm run lint && npm run test
```

After hook + UI (13-18):
```
cd frontend && npm run typecheck && npm run lint && npm run test
# then npm run dev and smoke-test manually
```

## Manual verification checklist (before Phase 6)

- [ ] Click any suggestion card. Empty assistant bubble appears with pulsing dots. Tokens stream in. Cursor blinks at the tail. Cursor disappears when stream ends.
- [ ] Type a question and press Enter. Same flow.
- [ ] Shift+Enter inserts a newline in the textarea without sending.
- [ ] Send button shows Stop icon while streaming. Disabled state visible.
- [ ] Cannot type while streaming (textarea disabled).
- [ ] Click a suggestion while streaming: user message appears in chat. Once the current stream ends, the queued response auto-fires (post-stream nudge).
- [ ] Open Settings: prompt textareas show real defaults, no longer empty. The "Detailed answer context" select is gone.
- [ ] Markdown: ask "show me a bullet list of three items" — bullets render. "Show me a code block of an HTTP GET" — code block with monospace font.
- [ ] With an invalid Groq key: empty assistant bubble + "Connection interrupted" pill.
- [ ] Stop the backend mid-stream: partial content stays + "Connection interrupted" pill.
- [ ] Auto-scroll: chat column stays at the bottom as new content arrives.
- [ ] Reload page: chat clears (settings preserved).

## Risks and unknowns

1. **httpx async streaming lifecycle.** If the client disconnects, FastAPI signals the generator. We do not explicitly close the upstream connection on client disconnect. Tradeoff: a disconnected user could leak one upstream request until it finishes. Acceptable for v1.
2. **Groq SSE format quirks.** Frames may arrive split across HTTP chunks. `aiter_lines()` handles line buffering. Comment-only lines and keep-alives (`: comment`) are filtered by the `data: ` prefix check.
3. **react-markdown peer deps.** Pulls unified, micromark, mdast. Bundle ~30 KB gzipped. No conflicts expected with Next 16 or React 19.
4. **Strict Mode double-effect on useChatStream.** First effect run + cleanup + second effect run. `lastHandledIdRef` absorbs duplicate fires.
5. **Append-then-fire race.** `setStreamingChat(true)` happens synchronously; the next chunk-driven re-render sees the placeholder bubble already in the messages array. No flicker.
6. **Partial UTF-8 across fetch chunks.** `TextDecoder({ stream: true })` already in `streamChat`. Safe.
7. **Markdown of incomplete code fence while streaming.** react-markdown renders partial fences as code blocks that grow. Acceptable.
8. **Post-stream nudge ordering.** If two suggestion clicks queue during one stream, only the most-recent user message will be detected after stream end. The earlier queued click is silently dropped. Tradeoff documented; UI disables clicks during streaming so this is a corner case.
9. **Settings v2 migration.** Pre-v1 installs that already migrated to v1 will now re-migrate to v2. Safe because migrate is idempotent and only fills empty values.
10. **Temperature 0.5 hardcoded.** Same rationale as suggestions: avoid Settings sprawl, keep demo deterministic.

## What Phase 5 will produce

- 18 file changes (4 backend, 14 frontend including 1 new hook, 1 new component file, and 1 npm install).
- New runtime deps: `react-markdown`, `remark-gfm`.
- Working chat column end-to-end: suggestion clicks and typed messages both stream from real Groq with markdown rendering, placeholder dots, streaming cursor, and interrupted pill.
- All existing tests (60 backend, 76 frontend) continue to pass.

## What Phase 5 will NOT produce

- Tests for the new code (Phase 6).
- Streaming cancellation (out of scope).
- Persistence, retry, attachments, etc. (out of scope).
- Iterated prompts based on `docs/observations.md` (separate human task).
