# mic-and-transcription

Status: Complete. 72 tests pass (26 backend, 46 frontend).

## What this is

The left column of the app. A mic button that records the user's microphone, ships 30-second audio chunks to Groq Whisper Large V3 through our backend, and appends the returned text to a scrolling transcript.

## Why it exists

Transcription is the root dependency for the entire product. Live suggestions, chat, and export all read from the same `transcript` array in the Zustand session store. Until this feature works end-to-end, nothing else produces useful output. It is therefore the first feature through the full 6-phase workflow.

## Success criteria

### Functional

1. User clicks the mic, grants browser permission, and recording begins within ~1 second.
2. Every 30 seconds a new transcript chunk appears below the previous one, in wall-clock timestamp order.
3. User clicks stop mid-chunk; the partial audio is still shipped and the resulting text appears in the transcript.
4. User can start and stop any number of times in one session; the transcript simply appends with no divider.
5. If the Groq API key is empty in Settings, clicking the mic does nothing beyond a toast that links to Settings.
6. If the browser denies microphone permission, the mic button enters a disabled state with a tooltip explaining why.
7. If three chunks fail transcription in a row, recording auto-stops with a persistent error banner.

### Quality

1. Transcript chunk visible within 3 seconds of the chunk closing, on a fast connection.
2. None of the known Whisper hallucinations ("Thank you.", "Thanks for watching.", etc.) appear in the transcript.
3. Audio chunks shorter than 2 seconds are never sent, so no empty or phantom bubbles appear.
4. The Groq API key is never logged on the server and never stored in backend memory beyond the request's lifetime.

### Out of scope (linked here for readability)

See `out-of-scope.md`.

## Dependencies

Inbound (must exist before this feature can work):
- Settings store with `groqApiKey` (done in scaffold).
- Zustand `useSessionStore` with `transcript` and `isRecording` fields (done).
- `POST /transcribe` route shape and Pydantic schemas (done; logic is a stub that this feature replaces).

Outbound (blocked by this feature):
- live-suggestions (needs transcript).
- chat-with-streaming (needs transcript).
- export (needs transcript).

## Files in this folder

- `README.md` (this file): what and why.
- `sub-features.md`: breakdown of the four sub-features.
- `design.md`: component tree, state, data flow, chunking strategy, latency budget.
- `edge-cases.md`: every edge case we intend to handle.
- `out-of-scope.md`: what is intentionally not included.
- `schemas.md`: the `/transcribe` contract and config constants added.
