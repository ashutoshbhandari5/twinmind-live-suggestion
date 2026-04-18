# Sub-features

## 1. dual-prompt system

Two editable constants in `frontend/lib/prompts.ts`:
- `DETAILED_ANSWER_PROMPT`: chosen when the last user message has `sourceSuggestion`.
- `CHAT_PROMPT`: chosen when the last user message is a plain typed question.

The client picks the right one and sends it as `prompt_template` on every request. The backend treats it as the SYSTEM message.

## 2. subscribe-and-fire dispatch

A new hook `useChatStream` subscribes to `useSessionStore.chatMessages`. When the last message is `role: "user"`, no assistant message exists after it, and `isStreamingChat` is false, it fires the stream. A `lastHandledIdRef` guarantees single-fire per user message.

Both suggestion clicks and typed messages funnel through this same hook because both just append to `chatMessages`.

Lives in `frontend/hooks/useChatStream.ts`.

## 3. token buffering

Inside `useChatStream`, incoming tokens accumulate in a ref buffer. A `setInterval` flushes the buffer to the assistant message via `appendChatToken` every ~50ms. This caps rerenders even when Groq streams 100+ tokens per second.

On stream end, the interval clears and any remaining buffer is flushed once.

## 4. chat input

`ChatInput` uses a Textarea (3-line fixed height, no auto-resize). Enter submits; Shift+Enter inserts a newline. The Send button is disabled while `isStreamingChat` is true and shows a Stop icon visually (no cancel action in v1).

The input clears on submit. Empty or whitespace-only messages are no-ops.

Lives in `frontend/components/chat/ChatInput.tsx`.

## 5. message rendering

`ChatMessage` renders one message at a time:
- User messages show a small "YOU" label. If `sourceSuggestion` is set, append the type: `YOU · ANSWER` with a colored badge. Content is plain text.
- Assistant messages show "ASSISTANT" label. Content is rendered through `AssistantMarkdown`.

Lives in `frontend/components/chat/ChatMessage.tsx`.

## 6. AssistantMarkdown

A constrained markdown renderer using `react-markdown` + `remark-gfm`. Allowed elements:
- paragraphs, headings `h1`–`h4`, bold, italic, strikethrough
- bulleted and ordered lists
- inline code, fenced code blocks
- blockquotes
- links (always open in a new tab with `rel="noopener noreferrer"`)

Disabled:
- raw HTML (`skipHtml`)
- images, iframes, embeds
- scripts

Lives in `frontend/components/chat/AssistantMarkdown.tsx`.

## 7. streaming cursor

A blinking cursor sits at the tail of the currently streaming assistant message. Implemented as a small `<span className="animate-pulse">▍</span>` appended at the end of the streamed text only while `isStreamingChat` is true and only on the last assistant message.

Lives inside `AssistantMarkdown` or a small wrapper.

## 8. placeholder bubble

From the moment the stream fires until the first token lands, the assistant message exists but has no content. The bubble shows a three-dot pulsing indicator instead. As soon as the first token flushes from the buffer, the dots are replaced by the streamed text.

## 9. mid-stream error handling

If the fetch throws, the stream closes early, or the backend returns a non-2xx mid-response, the partial content stays visible. A small pill `Connection interrupted` renders beneath the bubble. No retry button.

A new session-store field `chatError: "none" | "interrupted"` drives the pill. Cleared when a new user message is sent.

## 10. backend chat route

Real implementation replaces the mock. Pipeline:
1. Validate `x-groq-api-key` header (401 if empty).
2. Validate `prompt_template` is non-empty (400).
3. Assemble messages via `build_chat_prompt`.
4. Open an `httpx.AsyncClient` with `stream=True` against Groq's SSE endpoint.
5. Parse Groq's SSE frames, extract each token delta, yield as raw UTF-8 chunks.
6. `StreamingResponse` with `media_type="text/plain; charset=utf-8"`.

Error mapping matches suggestions: 401/413/429/502/504. Errors before the first token return a plain HTTPException. Errors after the first token close the stream early (the frontend handles that with the interrupted pill).

Lives in `backend/app/routes/chat.py`, `backend/app/services/groq_client.py`, `backend/app/services/prompt_builder.py`.

## 11. settings v2 migration

Remove `detailedAnswerContextMode: "full" | "windowed"` from the store, type, and Settings UI. Bump `persist` version to 2 with a migrate function that deletes the stale key from rehydrated localStorage. Also fill empty `detailedAnswerPrompt` and `chatPrompt` with the v1 defaults so pre-feature installs auto-upgrade, mirroring what we did for `suggestionPrompt` in v1.

Lives in `frontend/lib/settings-store.ts`, `frontend/app/settings/page.tsx`.
