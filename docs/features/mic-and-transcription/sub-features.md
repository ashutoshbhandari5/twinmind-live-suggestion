# Sub-features

Four concerns, one feature. Each has its own section in `design.md`.

## 1. mic-button

A visual state machine for the recording control. One circular button, five states:

- `idle`: solid blue circle. Click starts recording.
- `requesting-permission`: loading spinner while the browser permission prompt is open.
- `recording`: solid red with pulsing ring. Click stops.
- `denied`: grey, disabled. Tooltip on hover: "Microphone access denied. Enable it in browser settings."
- `error-autostop`: grey, disabled. Persistent banner above: "Recording stopped after 3 failed transcriptions. Check connection or key."

Lives in `frontend/components/transcript/MicButton.tsx`.

## 2. audio-capture

A MediaRecorder wrapper that produces one decodable WebM blob every 30 seconds, plus a final partial blob on stop.

Approach: restart MediaRecorder every 30 seconds on the same MediaStream, rather than relying on MediaRecorder's `timeslice`. The reason is the WebM header gotcha (see `design.md`).

Lives in `frontend/hooks/useRecorder.ts` and `frontend/lib/audio.ts`.

## 3. transcribe-pipeline

For each closed chunk: POST to `/transcribe` with the user's Groq key in the `x-groq-api-key` header. Backend forwards to Groq Whisper Large V3, applies the hallucination filter, returns `{text, duration_ms}`.

Retry policy owned by the frontend:
- One retry on any non-200 or network failure.
- On second failure, show a toast and increment a consecutive-failure counter.
- On three consecutive failures, call `stop()` and surface `error-autostop`.

Lives in `backend/app/routes/transcribe.py`, `backend/app/services/groq_client.py`, `backend/app/config.py`, and the existing `frontend/lib/api.ts` (no change expected).

## 4. transcript-feed

A vertical list rendered from `useSessionStore.transcript`. One card per chunk, with a wall-clock timestamp (`01:07:54 PM`) and the text body. Auto-scrolls to the newest item when a new chunk arrives.

Lives in `frontend/components/transcript/TranscriptFeed.tsx` and `frontend/components/transcript/TranscriptChunk.tsx`.
