# Schemas

## POST /suggestions

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
  "prompt_template": "string: the SYSTEM prompt from settings.suggestionPrompt",
  "context_chunk_count": 3,
  "session_duration_ms": 120000,
  "previous_suggestions": [
    {"type": "question", "preview": "string"}
  ]
}
```

Field notes:
- `transcript`: already sliced client-side to the last `context_chunk_count` chunks. Backend does not re-slice.
- `prompt_template`: may not be empty; backend returns 400 if blank.
- `context_chunk_count`: echoed into the USER prompt as "Recent transcript (last N chunks)". Must be ≥ 1; backend clamps to [1, 50].
- `session_duration_ms`: can be 0 if recording has not started or if `recordingStartedAt` is null.
- `previous_suggestions`: empty array for the first batch. Each entry contains only `type` and `preview`; we intentionally do not send `reasoning` to keep the payload small.

### Response 200

```json
{
  "batch_id": "b_abc123",
  "timestamp": 1700000000000,
  "moment_type": "question_asked",
  "suggestions": [
    {
      "id": "s_1",
      "type": "answer",
      "preview": "string, 1-2 sentences, delivers value alone",
      "reasoning": "string, one sentence"
    }
  ]
}
```

Field notes:
- `batch_id` and `suggestion.id` are generated server-side with `b_` and `s_` prefixes.
- `timestamp` is the server wall-clock at response time. The client uses this for the batch divider.
- `moment_type` is one of: `question_asked`, `claim_made`, `decision_point`, `topic_exploration`, `unfamiliar_term`, `idle`.
- `suggestions`: 1 to 3 items. Each `type` is one of: `question`, `talking_point`, `answer`, `fact_check`, `clarification`.

### Error responses

| Status | Detail | When |
|---|---|---|
| 400 | `prompt template is empty` | SYSTEM prompt blank |
| 400 | `transcript is empty` | zero-length transcript passed through |
| 401 | `missing groq key` | header absent or blank |
| 401 | `groq rejected the request` | upstream 401 |
| 429 | `rate limited` | upstream 429 |
| 502 | `groq upstream failed` | upstream 5xx or network error |
| 502 | `suggestions malformed` | Groq JSON failed validation after one retry |
| 504 | `groq timed out` | request exceeded `SUGGESTIONS_TIMEOUT_SECONDS` (15s) |

## Pydantic schemas

`backend/app/models/schemas.py`:

```python
MomentType = Literal[
    "question_asked",
    "claim_made",
    "decision_point",
    "topic_exploration",
    "unfamiliar_term",
    "idle",
]

class PreviousSuggestion(BaseModel):
    type: SuggestionType
    preview: str

class SuggestionsRequest(BaseModel):
    transcript: list[TranscriptChunk] = Field(default_factory=list)
    prompt_template: str = ""
    context_chunk_count: int = 3
    session_duration_ms: int = 0
    previous_suggestions: list[PreviousSuggestion] = Field(default_factory=list)

class SuggestionBatch(BaseModel):  # extended
    id: str
    timestamp: int
    moment_type: MomentType
    suggestions: list[Suggestion]

class SuggestionsResponse(BaseModel):  # extended
    batch_id: str
    timestamp: int
    moment_type: MomentType
    suggestions: list[Suggestion]
```

The old `context_window_seconds` and `session_started_at` fields are removed.

## TypeScript types

`frontend/lib/types.ts`:

```ts
export type MomentType =
  | "question_asked"
  | "claim_made"
  | "decision_point"
  | "topic_exploration"
  | "unfamiliar_term"
  | "idle";

export type SuggestionBatch = {
  id: string;
  timestamp: number;
  momentType: MomentType;
  suggestions: Suggestion[];
};

export type SuggestionsResponse = {
  batch_id: string;
  timestamp: number;
  moment_type: MomentType;
  suggestions: Suggestion[];
};
```

Note the field-naming asymmetry: backend uses `moment_type` (snake_case), frontend type uses `momentType` (camelCase). The API client performs the translation in `lib/api.ts`.

## Settings store changes

`frontend/lib/settings-store.ts`:

Remove:
- `suggestionContextWindowSeconds: number`

Add:
- `suggestionContextChunkCount: number` (default `3`)

Keep:
- `refreshIntervalSeconds: number` (default `30`, used only for the countdown display).

## Upstream Groq contract (reference)

For implementers of `groq_client.complete_json`:

- Endpoint: `POST https://api.groq.com/openai/v1/chat/completions`
- Auth: `Authorization: Bearer <key>`
- Body:
  ```json
  {
    "model": "openai/gpt-oss-120b",
    "messages": [
      {"role": "system", "content": "<SYSTEM prompt>"},
      {"role": "user", "content": "<assembled USER prompt>"}
    ],
    "response_format": {"type": "json_object"},
    "temperature": 0.3
  }
  ```
- Response: standard OpenAI chat-completions envelope. Read `choices[0].message.content` as a string and parse as JSON.

Temperature note: 0.3 keeps suggestions varied enough to feel fresh across batches without drifting away from the factual grounding. Exposing temperature in Settings is out of scope; hardcode it for consistency across submissions.
