# Design

## Component tree

```
TranscriptPanel
  ColumnHeader            status chip: IDLE | • RECORDING | DENIED | ERROR
  MicButton               the circular button and its status text
  TranscriptFeed          ScrollArea with auto-scroll on new chunk
    TranscriptChunk[]     one Card per chunk, timestamp + text
```

All four live under `frontend/components/transcript/`.

## State

Additions to `frontend/lib/store.ts`:

```ts
type SessionState = {
  // existing
  isRecording: boolean;
  recordingStartedAt: number | null;
  transcript: TranscriptChunk[];

  // new for this feature
  micPermission: "unknown" | "granted" | "denied";
  recorderError: "none" | "auto-stopped";

  setMicPermission: (status: SessionState["micPermission"]) => void;
  setRecorderError: (error: SessionState["recorderError"]) => void;
};
```

The consecutive-failure counter is local to `useRecorder` and not stored globally. Only the recorder cares about it, and surfacing it in the store would tempt other components to react to it.

## Data flow

### Start

```
User clicks MicButton
  if settings.groqApiKey === "":
    toast("Add your Groq key in Settings", link=/settings)
    abort
  if state.micPermission === "denied":
    no-op (button is already disabled)
    abort
  useRecorder.start()
    getUserMedia({ audio: true })
      granted:
        setMicPermission("granted")
        startRecording()   // flips isRecording, sets recordingStartedAt
        beginChunkLoop()
      denied:
        setMicPermission("denied")
        toast("Microphone access denied. Enable it in browser settings.")
        abort
```

### Chunk loop

```
t=0    new MediaRecorder(stream); recorder.start(); chunkStart = Date.now()
t=30   recorder.stop()  → dataavailable fires with blob
       durationMs = Date.now() - chunkStart
       new MediaRecorder(stream); start(); chunkStart = Date.now()
       if durationMs < 2000: skip POST, no bubble
       else: fetch POST /transcribe with blob + durationMs
         200 ok, text non-empty after filter:
           addTranscriptChunk({ id, text, timestamp: Date.now() })
           failureCount = 0
         200 ok, text empty after filter:
           failureCount = 0, no bubble
         non-200 or throw:
           retry once after 500ms
           second failure:
             failureCount++
             toast("Failed to transcribe last 30 seconds. Check connection or key.")
             if failureCount === 3:
               stop() (see below)
               setRecorderError("auto-stopped")
t=60   stop, start, fetch again, …
```

The fetch runs in parallel with the next chunk's recording. We never wait for transcription before starting the next 30 seconds.

### Stop (user-initiated)

```
User clicks MicButton while recording
  stop the current MediaRecorder
    dataavailable fires with whatever audio has been captured
    if blob.duration < 2000ms: do not POST, no bubble
    else: POST /transcribe like a normal chunk
  release MediaStream tracks (stream.getTracks().forEach(t => t.stop()))
  clear the 30s interval
  stopRecording()   // flips isRecording
```

### Stop (auto, after 3 failures)

Same as user-stop, except `setRecorderError("auto-stopped")` is set first and the button locks into its error state.

## API contract

See `schemas.md` for full detail. In short:

- `POST /transcribe`, multipart, `x-groq-api-key` header.
- Response `{ text: string, duration_ms: int }` where `text` is already trimmed and hallucination-filtered.
- Errors: 401 (Groq rejected key), 502 (Groq failed), 504 (Groq timed out).

## Chunking strategy

MediaRecorder with `timeslice` has a well-known gotcha: only the very first timeslice chunk contains the WebM header. Subsequent chunks are not independently decodable. Whisper needs a decodable file per request, so timeslice is not usable for this feature.

Approach: do not pass `timeslice` to `MediaRecorder.start()`. Instead, on a 30-second interval, stop the current recorder and immediately construct a new one on the same MediaStream.

```
t=0   recorderA = new MediaRecorder(stream); recorderA.start()
t=30  recorderA.stop()       → blobA (complete, decodable)
      recorderB = new MediaRecorder(stream); recorderB.start()
      POST blobA to /transcribe
t=60  recorderB.stop()       → blobB
      recorderC = new MediaRecorder(stream); recorderC.start()
      POST blobB to /transcribe
```

The gap between `stop()` and the next `start()` is roughly 50ms of audio loss per boundary. At conversational pace this is inaudible. Whisper is tolerant.

Why not one long recorder with timeslice and server-side stitching: stitching the header forward is brittle across codecs and browsers. Restart is simpler and robust.

Why not a smaller chunk size (e.g., 10s): Groq Whisper Large V3 has a per-request minimum setup cost, and the suggestion loop only consumes new transcript every 30s anyway. 30s is the sweet spot.

## Hallucination filter

Backend-side, applied to `text.strip().lower()` of the Whisper response before returning:

```python
WHISPER_HALLUCINATIONS = frozenset({
    "thank you.",
    "thanks for watching.",
    "thanks for watching!",
    "subtitles by the amara.org community",
    "you",
    ".",
    "",
})
```

If the stripped lowercased text is in this set, the backend returns `{text: "", duration_ms}`. The frontend does not append an empty chunk.

Intentional limit: this filter only matches the full trimmed text. A response like `"Thanks for watching. Then we talked about Q3 numbers."` is not filtered. That is correct. We want precision over recall, because silencing mixed output would destroy real transcript content.

Client-side complement: if a chunk's audio duration is under 2000ms, the client does not POST it at all. This avoids the common case where a stop-right-after-start produces a ~100ms chunk that Whisper would turn into pure hallucination.

## Latency budget

Target: chunk closes → text visible in transcript within 3 seconds.

| Step | Budget |
|---|---|
| Blob prepared from MediaRecorder | ~50ms |
| Fetch to backend | 50ms |
| Backend to Groq Whisper | 800ms to 2s typical |
| Backend to frontend | 50ms |
| React render + scroll | 50ms |
| **Total** | ~1.0s to 2.2s |

This fits the 3s target with room. We do not add any artificial buffering on the transcription path. The suggestions loop can poll the transcript whenever it likes; it does not block on in-flight transcriptions.

## Files that change

Frontend:
- `lib/audio.ts`: `startMicStream()` helper, `estimateBlobDurationMs()` helper.
- `hooks/useRecorder.ts`: the state machine described above, returns `{ start, stop }`.
- `components/transcript/MicButton.tsx`: visual states, click guard (api key, permission), tooltip.
- `components/transcript/TranscriptFeed.tsx`: ScrollArea from shadcn, auto-scroll on transcript.length change.
- `components/transcript/TranscriptChunk.tsx`: timestamp (formatted as `hh:mm:ss A`) + text body.
- `components/transcript/TranscriptPanel.tsx`: wires the status chip in ColumnHeader to `isRecording` and `recorderError`.
- `lib/store.ts`: `micPermission`, `recorderError`, and their setters.
- `lib/api.ts`: no change (`transcribeAudio` already exists).

Backend:
- `app/routes/transcribe.py`: construct GroqClient, call `transcribe()`, apply filter, return.
- `app/services/groq_client.py`: implement `transcribe(audio_bytes, filename)` against `POST https://api.groq.com/openai/v1/audio/transcriptions`, model `whisper-large-v3`, `response_format=text`.
- `app/config.py`: add `WHISPER_HALLUCINATIONS` and `MIN_CHUNK_DURATION_MS`.

No schema changes. `TranscribeResponse` already matches the planned response shape.
