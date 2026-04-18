# Design

## Component tree

```
ChatPanel
  ColumnHeader                right: "SESSION-ONLY"
  Body (scrollable)
    HintCard                  empty-state hint (pre-first-message)
    ChatMessage[]
      user variant            small "YOU" label plus optional type badge
      assistant variant       "ASSISTANT" label, AssistantMarkdown body
        placeholder dots      before first token
        streamed text         via AssistantMarkdown
        streaming cursor      blinking, last message only
        interrupted pill      when chatError = "interrupted"
  ChatInput                   textarea + Send button (fixed bottom)
```

## State

### Session store additions

`frontend/lib/store.ts`:

```ts
type ChatError = "none" | "interrupted";

// in SessionState:
chatError: ChatError;
setChatError: (error: ChatError) => void;
```

Initial `"none"`. Reset with the rest of `initialState`. Cleared by `useChatStream` when a new user message is sent.

No new fields beyond `chatError`. `chatMessages`, `isStreamingChat`, `addChatMessage`, `appendChatToken`, `setStreamingChat` already exist.

### Settings store changes

`frontend/lib/settings-store.ts`:

Remove:
- `detailedAnswerContextMode: "full" | "windowed"`

Keep:
- `detailedAnswerPrompt: string` (now populated with a real default)
- `chatPrompt: string` (now populated with a real default)

Bump `persist.version` from `1` to `2`. Migrate function drops the stale field and fills empty prompts with defaults.

## Data flow

### User types and submits

```
User types in ChatInput, hits Enter
  → handleSubmit reads textarea value, trims
  → if empty, no-op
  → session.addChatMessage({
       id: uuid,
       role: "user",
       content: text,
       timestamp: Date.now(),
       sourceSuggestion: undefined,
     })
  → clear textarea
```

### User clicks a suggestion (already implemented in live-suggestions)

```
SuggestionCard.handleClick
  → session.addChatMessage({
       id: uuid,
       role: "user",
       content: suggestion.preview,
       timestamp: Date.now(),
       sourceSuggestion: { type, preview },
     })
```

### Subscribe and fire

```
useChatStream (runs from page.tsx, one instance)
  useEffect deps: chatMessages.length

  on change:
    last = chatMessages[chatMessages.length - 1]
    if !last, return
    if last.role !== "user", return
    if session.isStreamingChat, return
    if lastHandledIdRef.current === last.id, return

    lastHandledIdRef.current = last.id
    fire(last)
```

### fire(userMessage)

```
session.setChatError("none")

// Pick prompt based on source.
template = userMessage.sourceSuggestion
  ? settings.detailedAnswerPrompt
  : settings.chatPrompt

// Create the placeholder assistant bubble.
assistantId = uuid()
session.addChatMessage({
  id: assistantId,
  role: "assistant",
  content: "",
  timestamp: Date.now(),
})
session.setStreamingChat(true)

// Spin up the flush interval.
buffer = ""
flushIntervalId = setInterval(() => {
  if (buffer.length === 0) return
  const chunk = buffer
  buffer = ""
  session.appendChatToken(assistantId, chunk)
}, 50)

// Stream.
try {
  await streamChat({
    apiKey,
    transcript: session.transcript,
    messages: session.chatMessages.slice(0, -1), // exclude the assistant placeholder we just added
    newMessage: userMessage.content,
    sourceSuggestion: userMessage.sourceSuggestion ?? null,
    promptTemplate: template,
    onToken: (tok) => { buffer += tok },
  })
  // success: flush final buffer
  clearInterval(flushIntervalId)
  if (buffer.length > 0) session.appendChatToken(assistantId, buffer)
} catch (err) {
  clearInterval(flushIntervalId)
  if (buffer.length > 0) session.appendChatToken(assistantId, buffer)
  session.setChatError("interrupted")
} finally {
  session.setStreamingChat(false)
}
```

Edge note: we exclude the just-added assistant placeholder from the `messages` payload because the model has not answered it yet. The user turn is `newMessage`.

### Backend /chat

```
POST /chat
  Header x-groq-api-key required (401 if empty)
  Body prompt_template required, non-empty (400)

  Build messages via build_chat_prompt:
    system = prompt_template + "\n\n[Live meeting transcript]\n" + transcript_block
    turns = prior_messages converted to {role, content}
      user message content = original content (already has suggestion info if applicable)
      assistant message content = as-is
    final_user_turn = derived from new_message and source_suggestion:
      if source_suggestion:
        "Click-through: [{type}] {preview}\nInternal reasoning: {reasoning}\nExplain in depth using the transcript and prior chat as context."
      else:
        new_message
    messages = [system] + turns + [final_user_turn]

  async with httpx.AsyncClient(timeout=CHAT_TIMEOUT_SECONDS):
    POST GROQ /chat/completions stream=True
    for each SSE data frame:
      parse JSON
      extract choices[0].delta.content (if present, non-empty)
      yield bytes

  StreamingResponse(gen, media_type="text/plain; charset=utf-8")
```

## Prompt assembly details

`build_chat_prompt` lives in `backend/app/services/prompt_builder.py`. Signature:

```python
def build_chat_prompt(
    transcript: list[TranscriptChunk],
    messages: list[ChatMessage],
    new_message: str,
    source_suggestion: dict | None,
    prompt_template: str,
) -> list[dict[str, str]]:
    """Return a list of OpenAI chat completion messages."""
```

Returns `messages` list suitable for Groq's `/chat/completions` body.

Construction:

1. `transcript_block = "\n".join(f"[{clock}] {text}" for chunk in transcript)` or `"(no transcript yet)"`.
2. System content = `prompt_template + "\n\n[Live meeting transcript]\n" + transcript_block`.
3. For each prior `ChatMessage` (in order), append `{"role": m.role, "content": m.content}`. Skip any empty-content messages (this filters out the placeholder assistant if it somehow slipped in).
4. For the final turn:
   - If `source_suggestion` is not None:
     `"Click-through: [{type}] {preview}\nInternal reasoning: {reasoning}\nExplain in depth using the transcript and prior chat as context."`
   - Else: use `new_message` directly.
5. Append `{"role": "user", "content": final}`.

Reasoning for putting transcript in the system message: it is static context, not a chat turn. Keeps the turn history clean and matches how LLMs process context.

## API contract summary

`POST /chat` (changes marked):

Request body:
```json
{
  "transcript": [{"id":"...","text":"...","timestamp":0}],
  "messages": [{"id":"...","role":"user|assistant","content":"...","timestamp":0,"sourceSuggestion":{...}|null}],
  "new_message": "string",
  "source_suggestion": {"type":"answer","preview":"...","reasoning":"..."} | null,  // NEW
  "prompt_template": "SYSTEM prompt from settings"
}
```

Response:
- `Content-Type: text/plain; charset=utf-8`
- Chunked transfer; body is a stream of UTF-8 tokens in the order the model produced them.
- On success the connection closes naturally.
- On error before the first token: standard `HTTPException` JSON body.
- On error after the first token: connection closes early; client counts this as "interrupted."

Full contract in `schemas.md`.

## Streaming protocol detail

Groq's `/chat/completions` with `stream=true` returns SSE: lines of `data: {...}\n\n` where each JSON has `choices[0].delta.content` holding the next token, and a final `data: [DONE]\n\n` frame.

Our backend parses that SSE and yields token strings as bytes on an `httpx` stream response. The client reads with a `ReadableStreamDefaultReader` and decodes each chunk as UTF-8, calling `onToken` with the text.

We do NOT expose SSE to the client. We flatten to chunked plain text. Tradeoff: we cannot distinguish "done" from "error" on the wire; the connection closing is the signal. If the connection closes mid-response, the frontend treats it as interrupted. This is acceptable for v1 per the product decision.

## Frontend markdown rendering

`AssistantMarkdown` wraps `ReactMarkdown` with these plugins and options:

```tsx
<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  skipHtml
  components={{
    a: ({href, children}) => (
      <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
    ),
    img: () => null,     // drop images
    iframe: () => null,  // defensive
    script: () => null,
    // h1-h4 with muted weights, code with monospace font, etc.
  }}
/>
```

`skipHtml: true` prevents raw HTML injection. GFM enables tables, strikethrough, task lists, autolinks.

Security: the model's output flows untrusted through this renderer. The constraints above prevent XSS. If we later want images, we whitelist the `img` component with a URL sanitizer. For v1 we drop them entirely.

## Chat input detail

```tsx
<form onSubmit={handleSubmit}>
  <textarea
    rows={3}
    value={draft}
    onChange={(e) => setDraft(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    }}
    placeholder="Ask anything..."
    disabled={isStreamingChat}
  />
  <Button type="submit" disabled={isStreamingChat || draft.trim() === ""}>
    {isStreamingChat ? <Square /> : "Send"}
  </Button>
</form>
```

Fixed rows=3; no resize. Submit on Enter without Shift. Send button disabled when streaming or draft empty.

## Latency budget

Target: first token under 2 seconds.

| Step | Budget |
|---|---|
| Store append + re-render | 20ms |
| Fetch to backend | 30ms |
| Backend to Groq | 50ms |
| Groq: first token TTFT | 400-1500ms |
| Backend stream pass-through | ~0ms |
| First paint | 50ms |
| **Total** | ~550-1600ms |

Within budget. The 50ms flush interval adds at most one tick of rendering lag (imperceptible).

## Files that change

Frontend:
- `lib/prompts.ts`: real `DETAILED_ANSWER_PROMPT` and `CHAT_PROMPT`.
- `lib/store.ts`: `chatError` field and setter.
- `lib/settings-store.ts`: remove `detailedAnswerContextMode`, bump to v2, migrate.
- `lib/api.ts`: extend `streamChat` to accept `sourceSuggestion` param; serialize as `source_suggestion`.
- `app/settings/page.tsx`: remove the context-mode select.
- `hooks/useChatStream.ts`: new hook implementing the subscribe-and-fire + buffered flush.
- `components/chat/AssistantMarkdown.tsx`: new.
- `components/chat/ChatMessage.tsx`: rewrite to show YOU/ASSISTANT labels, optional type badge on user messages, markdown body, streaming cursor, interrupted pill.
- `components/chat/ChatInput.tsx`: rewrite to use Textarea with Enter/Shift+Enter.
- `components/chat/ChatPanel.tsx`: rewrite to render messages list and auto-scroll.
- `app/page.tsx`: instantiate `useChatStream()`. It does not need a handle passed anywhere; it operates purely through the store.

Backend:
- `app/services/groq_client.py`: implement `stream_chat` with real SSE parsing.
- `app/services/prompt_builder.py`: implement `build_chat_prompt`.
- `app/routes/chat.py`: real implementation with error mapping.
- `app/models/schemas.py`: add `source_suggestion` to `ChatRequest`.

Dependencies:
- frontend: add `react-markdown`, `remark-gfm`.

## Risks and unknowns

1. **Groq SSE parsing edge cases**. Data frames can split across HTTP chunks. We buffer by newline-delimited frames and handle the `[DONE]` sentinel. Standard SSE parsing.
2. **Backpressure**. If the client closes the tab mid-stream, our generator will raise `ClientDisconnect`. Handle with a try/finally that closes the upstream Groq stream. FastAPI's `StreamingResponse` handles most of this.
3. **Markdown injection**. Model could emit malicious markdown. Mitigated by `skipHtml` + component whitelist + `remark-gfm` safe-mode-ish defaults.
4. **Partial UTF-8**. A multi-byte codepoint could split across two fetch chunks. `TextDecoder` with `stream: true` (already used in existing `streamChat`) handles this.
5. **Token ordering**. Groq delivers in order. No reordering concern.
6. **Settings localStorage**. v1 install has `detailedAnswerContextMode`. v2 migrate drops it.
7. **Subscribe-and-fire double-invoke**. React Strict Mode mounts the hook twice in dev. Guarded by `lastHandledIdRef` + `isStreamingChat` check; re-entry is a no-op.
