# chat-with-streaming

Status: Complete. 201 tests pass (82 backend, 119 frontend).

## What this is

The right column of the app. Two entry points, one stream:

1. User clicks a suggestion card in the middle column. A user message appears in the chat with the suggestion's type and preview. An assistant answer streams in below it, grounded in the full transcript and full prior chat.
2. User types directly in the chat input. The same stream pipeline produces the answer.

Both flows hit `POST /chat`. The backend picks the prompt based on whether the last user message carried a `source_suggestion`, streams tokens from Groq GPT-OSS 120B, and pipes them to the client as raw chunked text.

## Why it exists

Evaluation criterion #2 is "Quality of detailed chat answers when clicked." This column is where every click pays off. The first three criteria all hinge on this feature working end-to-end. Without it, the suggestions column is an empty promise.

## Success criteria

### Functional

1. Clicking a suggestion card appends a user message with the suggestion's `type` and `preview`. The assistant response streams in below.
2. Typing in the chat input and pressing Enter (without Shift) appends a user message. The assistant response streams in below.
3. Shift+Enter inserts a newline in the input.
4. The send button is disabled while a stream is in flight. The button shows a stop icon during streaming (visual only; cancellation is out of scope for v1).
5. An empty assistant bubble appears immediately when the request fires, with a subtle loading dot. When the first token arrives the dot is replaced with streaming text.
6. Tokens from Groq are buffered and flushed to the store every ~50ms so the UI never rerenders faster than it can paint.
7. A blinking cursor sits at the tail of the streaming message. It disappears when the stream ends.
8. If the stream drops mid-response, the partial message is preserved and a small `Connection interrupted` pill appears under it.
9. The chat column auto-scrolls to the newest message as it grows.
10. The chat column scrolls independently within its column (already fixed in the layout pass).
11. One continuous chat per session. Reload resets everything.

### Quality

1. The detailed-answer prompt produces substantive, concrete responses that reference the transcript when it sharpens the answer. Markdown rendering renders bullets, bold, code blocks.
2. The chat prompt produces concise but complete answers suitable for mid-conversation use.
3. No generic boilerplate ("Great question!"). Responses land on specifics immediately.
4. The model never sees raw HTML in the user's content.

### Non-functional

1. Typical time to first token under 2s on a healthy connection.
2. No XSS surface: markdown renderer rejects raw HTML, images, iframes.
3. The Groq API key is never logged.

## Dependencies

Inbound (done):
- `ChatMessage` type and session store actions.
- Suggestion card click already appends a user `ChatMessage` with `sourceSuggestion` set.
- `useAutoRefresh` pattern (for the subscribe-to-store trigger model).

Outbound:
- export: chat history must serialize cleanly.

## Files in this folder

- `README.md` (this file).
- `sub-features.md`: breakdown of sub-features.
- `design.md`: components, state, data flow, streaming, token buffering, prompt assembly.
- `edge-cases.md`: every case.
- `out-of-scope.md`: intentional exclusions.
- `prompts.md`: the two prompts (`DETAILED_ANSWER_PROMPT` and `CHAT_PROMPT`) with template variables.
- `schemas.md`: `POST /chat` request/response and ChatRequest model changes.

## Note on the prompts

v1 prompts. Real iteration happens after `docs/observations.md` is filled in from three real TwinMind sessions. Users can edit both prompts at runtime via Settings.

## Future improvements (not in scope here)

- Streaming cancellation with an abort controller.
- Retry button on errored messages.
- Persistence of chat history across reloads.
- Attachments, voice notes, code execution.
- Message search or in-chat navigation.
- Rate-limit-aware feedback beyond the generic "Connection interrupted" pill.
- Multi-language prompts.
