# Schemas

Contracts touched by this feature. No breaking changes; the scaffold already defined the right shapes.

## POST /transcribe

### Request

Headers:
- `x-groq-api-key: gsk_...` — required. Backend returns 401 if empty or missing.
- `Content-Type: multipart/form-data; boundary=...` — set automatically by the browser.

Body (multipart form):
- Field `file`: the audio blob. MIME is whatever MediaRecorder produced. Typically `audio/webm;codecs=opus` on Chromium browsers, `audio/mp4` on Safari. Filename `chunk.webm` (arbitrary; only forwarded to Groq).
- Field `duration_ms`: integer. Audio duration in milliseconds, measured client-side as `Date.now()` delta between recorder start and stop. The backend echoes this value back in the response.

### Response 200

```json
{
  "text": "already trimmed and hallucination-filtered; may be empty",
  "duration_ms": 29840
}
```

`duration_ms` is the value the client sent in the request, echoed back unchanged. The backend does not decode the audio to verify it. The client uses this value (trusted and echoed) only for the export payload. If the filter empties the text, `duration_ms` is still echoed.

### Error responses

| Status | Body | Cause |
|---|---|---|
| 400 | `{"detail": "missing audio file"}` | multipart upload with no `file` field |
| 401 | `{"detail": "groq rejected the request"}` | upstream 401 (empty key, invalid key) |
| 413 | `{"detail": "audio too large"}` | upstream 413 (Groq limit) |
| 429 | `{"detail": "rate limited"}` | upstream 429 |
| 502 | `{"detail": "groq upstream failed"}` | upstream 5xx or non-JSON response |
| 504 | `{"detail": "groq timed out"}` | request exceeded `TRANSCRIBE_TIMEOUT_SECONDS` (30s) |

Backend does not retry. The frontend owns retry policy.

## Pydantic models

`backend/app/models/schemas.py` already defines:

```python
class TranscribeResponse(BaseModel):
    text: str
    duration_ms: int
```

No changes needed.

## TypeScript types

`frontend/lib/types.ts` already defines:

```ts
export type TranscribeResponse = {
  text: string;
  duration_ms: number;
};
```

No changes needed.

## Config constants added

`backend/app/config.py`:

```python
WHISPER_HALLUCINATIONS: frozenset[str] = frozenset({
    "thank you.",
    "thanks for watching.",
    "thanks for watching!",
    "subtitles by the amara.org community",
    "you",
    ".",
    "",
})

# Client-side guard; server tolerates shorter but will usually get empty output anyway.
MIN_CHUNK_DURATION_MS: int = 2000
```

Comparison is done against `text.strip().lower()`.

## Upstream Groq contract (reference)

For implementers of `groq_client.transcribe`:

- Endpoint: `POST https://api.groq.com/openai/v1/audio/transcriptions`
- Auth: `Authorization: Bearer <key>`
- Body (multipart): `file=<bytes>`, `model=whisper-large-v3`, `response_format=text`
- Response when `response_format=text`: plain text body, not JSON. The backend wraps it in our `TranscribeResponse` shape.

If we later need segment-level timestamps for richer UI (not in MVP scope), switch to `response_format=verbose_json`.
