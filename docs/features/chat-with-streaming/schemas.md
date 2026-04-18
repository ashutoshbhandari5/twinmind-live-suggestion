# Schemas

## POST /chat

### Request

Headers:
- `x-groq-api-key: gsk_...` (required; backend returns 401 if empty).
- `Content-Type: application/json`.

Body:

```json
{
  "transcript": [
    {"id": "c_1", "text": "string", "timestamp": 1700000000000}
  ],
  "messages": [
    {
      "id": "m_1",
      "role": "user",
      "content": "string",
      "timestamp": 1700000000000,
      "sourceSuggestion": {"type": "answer", "preview": "..."} 
    },
    {
      "id": "m_2",
      "role": "assistant",
      "content": "string",
      "timestamp": 1700000000000
    }
  ],
  "new_message": "string",
  "source_suggestion": {
    "type": "answer",
    "preview": "...",
    "reasoning": "..."
  },
  "prompt_template": "SYSTEM prompt from settings"
}
```

Field notes:
- `transcript`: full transcript. Backend includes it verbatim in the system message.
- `messages`: full prior chat history (not including the placeholder assistant bubble the frontend just created).
- `new_message`: the user's text for typed messages. For suggestion clicks this is also the preview (the client sets it the same way the card sets `content`).
- `source_suggestion`: present when the last user turn is a suggestion click. `reasoning` is included in the backend-synthesized turn but not in the user-visible preview.
- `prompt_template`: `DETAILED_ANSWER_PROMPT` when `source_suggestion` is set, `CHAT_PROMPT` otherwise. Client chooses.

### Response 200

- `Content-Type: text/plain; charset=utf-8`.
- Chunked transfer; body is a stream of UTF-8 token strings in model order.
- Connection closes naturally on completion.

### Error responses

Errors emitted before any tokens are JSON HTTPException payloads.

| Status | Detail | When |
|---|---|---|
| 400 | `prompt template is empty` | SYSTEM prompt blank |
| 400 | `new_message is empty` | no text and no `source_suggestion` |
| 401 | `missing groq key` | header absent or blank |
| 401 | `groq rejected the request` | upstream 401 |
| 413 | `request too large` | upstream 413 |
| 429 | `rate limited` | upstream 429 |
| 502 | `groq upstream failed` | upstream 5xx or network error before first token |
| 504 | `groq timed out` | upstream did not start streaming within `CHAT_TIMEOUT_SECONDS` (60s) |

Errors after the first token close the stream silently. The client's `streamChat` awaits the reader and detects the early close; no JSON error is delivered mid-stream.

## Pydantic models

`backend/app/models/schemas.py`:

```python
class ChatRequestSourceSuggestion(BaseModel):
    type: SuggestionType
    preview: str
    reasoning: str = ""

class ChatRequest(BaseModel):
    transcript: list[TranscriptChunk] = Field(default_factory=list)
    messages: list[ChatMessage] = Field(default_factory=list)
    new_message: str = ""
    source_suggestion: ChatRequestSourceSuggestion | None = None
    prompt_template: str = ""
```

`ChatMessage` is unchanged.

## TypeScript types

`frontend/lib/types.ts`: no changes. `ChatMessage` already carries `sourceSuggestion?: { type, preview }`, which is what we forward for display. The `reasoning` lives only on the original `Suggestion` and is looked up by the frontend at send time (the suggestion card captures it in a closure and passes it to the stream call).

Actually — `sourceSuggestion` on the existing `ChatMessage` type does not include `reasoning`. We extend it so that the chat stream hook can pass `reasoning` to the API without a separate lookup:

```ts
export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  sourceSuggestion?: { type: SuggestionType; preview: string; reasoning?: string };
};
```

Minimal, backward-compatible addition. The suggestion card sets `reasoning` at append time.

## Session store changes

`frontend/lib/store.ts`:

```ts
type ChatError = "none" | "interrupted";

// in SessionState:
chatError: ChatError;
setChatError: (error: ChatError) => void;
```

Initial `"none"`. Reset in `reset()`.

## Settings store changes

`frontend/lib/settings-store.ts`:

- Remove field `detailedAnswerContextMode: "full" | "windowed"` from type, defaults, and UI.
- Bump `persist.version` from `1` to `2`.
- Migrate: drop `detailedAnswerContextMode`; fill any empty `detailedAnswerPrompt` or `chatPrompt` with current defaults.

## Upstream Groq contract (reference)

For implementers of `groq_client.stream_chat`:

- Endpoint: `POST https://api.groq.com/openai/v1/chat/completions`
- Auth: `Authorization: Bearer <key>`
- Body:
  ```json
  {
    "model": "openai/gpt-oss-120b",
    "messages": [...],
    "temperature": 0.5,
    "stream": true
  }
  ```
- Response: SSE. Each data frame is `data: {...}\n\n` with OpenAI-compatible chat completion chunks. Extract `choices[0].delta.content` per chunk. Final frame is `data: [DONE]\n\n`.

Temperature hardcoded at 0.5 for chat (higher than suggestions' 0.3) to favor fluency without drifting from grounding.
