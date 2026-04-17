# Implementation plan

Status: Phase 4. Awaiting plan review gate.

## Ordering principle

Backend first, then frontend foundation (store, audio helpers, recorder hook), then frontend UI components, then panel wiring. Within each layer the lowest-level file goes first. Every step leaves the tree in a compilable state.

## Sequence

### Step 1. Backend config constants

File: `backend/app/config.py`

Add:

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

MIN_CHUNK_DURATION_MS: int = 2000
```

Complexity: low.
Depends on: nothing.

### Step 2. Implement GroqClient.transcribe

File: `backend/app/services/groq_client.py`

Replace the `NotImplementedError` body. New signature:

```python
async def transcribe(
    self, audio_bytes: bytes, filename: str, content_type: str
) -> str:
```

Logic:
- POST to `f"{GROQ_API_BASE}/audio/transcriptions"`.
- Headers: `Authorization: Bearer {self._api_key}`.
- Multipart: `file=(filename, audio_bytes, content_type)`, `model=GROQ_WHISPER_MODEL`, `response_format=text`.
- Timeout: `TRANSCRIBE_TIMEOUT_SECONDS` (30s).
- Use `async with httpx.AsyncClient(timeout=...) as client`.
- Call `response.raise_for_status()`.
- Return `response.text` (Groq sends plain text when `response_format=text`).

Complexity: medium. Forwarding the browser-provided MIME is the easiest place to trip.
Depends on: step 1 (uses `GROQ_WHISPER_MODEL`, `GROQ_API_BASE`, `TRANSCRIBE_TIMEOUT_SECONDS` which already exist).

### Step 3. Wire the /transcribe route

File: `backend/app/routes/transcribe.py`

Replace the stub body. New signature:

```python
async def transcribe(
    file: UploadFile = File(...),
    duration_ms: int = Form(0),
    x_groq_api_key: str = Header(default=""),
) -> TranscribeResponse:
```

Logic:
- If `x_groq_api_key == ""`: raise `HTTPException(401, "missing groq key")`.
- Read `audio_bytes = await file.read()`. If `len(audio_bytes) == 0`: raise 400.
- Construct `client = GroqClient(x_groq_api_key)`.
- Call `raw = await client.transcribe(audio_bytes, file.filename or "chunk.webm", file.content_type or "audio/webm")`.
- Wrap network errors:
  - `httpx.TimeoutException` → `HTTPException(504, "groq timed out")`.
  - `httpx.HTTPStatusError` → map `e.response.status_code`:
    - 401 → 401, "groq rejected the request"
    - 413 → 413, "audio too large"
    - 429 → 429, "rate limited"
    - anything else (incl. 5xx) → 502, "groq upstream failed"
  - any other `httpx.HTTPError` → 502.
- Filter: `filtered = "" if raw.strip().lower() in WHISPER_HALLUCINATIONS else raw.strip()`.
- Return `TranscribeResponse(text=filtered, duration_ms=duration_ms)`.

Complexity: medium.
Depends on: steps 1 and 2. Also needs `from fastapi import Form, HTTPException` and `from app.services.groq_client import GroqClient` plus the filter constant import.

### Step 4. Extend session store

File: `frontend/lib/store.ts`

Add to the `SessionState` type:

```ts
micPermission: "unknown" | "granted" | "denied";
recorderError: "none" | "auto-stopped";
setMicPermission: (status: SessionState["micPermission"]) => void;
setRecorderError: (error: SessionState["recorderError"]) => void;
```

Add to `initialState`: `micPermission: "unknown"`, `recorderError: "none"`.
Add setters that `set({ micPermission })` and `set({ recorderError })`.
Extend `reset()` to include both new fields.

Complexity: low.
Depends on: nothing.

### Step 5. Audio helpers

File: `frontend/lib/audio.ts`

Replace `export {}`:

```ts
export async function startMicStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
}

export function pickRecorderMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  throw new Error("No supported MediaRecorder MIME type on this browser");
}

export const MIN_CHUNK_DURATION_MS = 2000;
```

Complexity: low.
Depends on: nothing.

### Step 6. Update api.ts to send duration_ms

File: `frontend/lib/api.ts`

Change `transcribeAudio` signature:

```ts
export async function transcribeAudio(args: {
  apiKey: string;
  audio: Blob;
  durationMs: number;
}): Promise<TranscribeResponse>
```

Append `form.append("duration_ms", String(args.durationMs))` before the fetch. No other changes.

Complexity: low.
Depends on: nothing.

### Step 7. useRecorder hook

File: `frontend/hooks/useRecorder.ts`

Replace `export {}` with an imperative hook:

```ts
export function useRecorder(): {
  start: () => Promise<void>;
  stop: () => Promise<void>;
};
```

State held in refs (never in useState, to avoid re-renders on every tick):
- `streamRef: MediaStream | null`
- `recorderRef: MediaRecorder | null`
- `intervalRef: ReturnType<typeof setInterval> | null`
- `chunkStartRef: number` (ms since epoch)
- `failureCountRef: number`
- `mimeRef: string`
- `isStartingRef: boolean` (guards double-click during `getUserMedia`)

Read from stores via `useSessionStore.getState()` and `useSettingsStore.getState()` inside callbacks, not at the top level. This keeps the hook stable across re-renders.

`start()`:
1. If `isStartingRef.current || useSessionStore.getState().isRecording`: return.
2. `isStartingRef.current = true`.
3. If settings key is empty: `toast.error("Add your Groq key in Settings")` with a link action; release guard; return.
4. Try `startMicStream()`. On rejection: `setMicPermission("denied")`, toast, release guard, return.
5. On success: `setMicPermission("granted")`, `startRecording()`, `mimeRef = pickRecorderMimeType()`.
6. Construct and start the first recorder (see helper below). Set `intervalRef` to rotate every 30s.
7. Release guard.

`rotate()` (internal):
1. Close current recorder: attach a one-shot `ondataavailable` that resolves a Promise with the blob; call `recorder.stop()`. Await the blob.
2. Compute `durationMs = Date.now() - chunkStartRef`.
3. Immediately start a new recorder (`chunkStartRef = Date.now()` before `start()`).
4. If `durationMs < MIN_CHUNK_DURATION_MS`: return (skip POST).
5. POST via `transcribeAudio({apiKey, audio: blob, durationMs})`. On network error or non-2xx, wait 500ms and retry once.
6. On success: if `result.text` non-empty, `addTranscriptChunk({id: crypto.randomUUID(), text: result.text, timestamp: Date.now()})`. Reset `failureCountRef = 0`.
7. On second failure: `failureCountRef += 1`, toast; if `failureCountRef >= 3`, call `stop()` then `setRecorderError("auto-stopped")`.

`stop()`:
1. Clear `intervalRef`.
2. If recorder is running, capture its final blob the same way `rotate` does and run the POST path (respecting the 2s minimum and retry policy). Await completion so final-chunk text has a chance to append.
3. Release all MediaStream tracks (`streamRef.getTracks().forEach(t => t.stop())`).
4. `stopRecording()`. Null out all refs.

Complexity: high. State machine plus cleanup plus concurrency.
Depends on: steps 4, 5, 6. Uses `sonner` for toast (already wired in RootLayout).

### Step 8. TranscriptChunk component

File: `frontend/components/transcript/TranscriptChunk.tsx`

Replace the placeholder:
- Props: `{ chunk: TranscriptChunkType }`.
- No Card wrapper. Match the prototype's line aesthetic: one flex row with the timestamp in `text-[10px] tracking-widest text-muted-foreground` and the text in `text-sm leading-relaxed` below it.
- Format timestamp via `Intl.DateTimeFormat("en-US", {hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true}).format(new Date(chunk.timestamp))` (produces `1:07:54 PM`).

Complexity: low.
Depends on: nothing new.

### Step 9. TranscriptFeed component

File: `frontend/components/transcript/TranscriptFeed.tsx`

Replace the placeholder:
- Consume `useSessionStore((s) => s.transcript)` and `useSessionStore((s) => s.isRecording)`.
- Render a `ScrollArea` (shadcn) filling `flex-1`.
- Inside: `transcript.map((c) => <TranscriptChunk key={c.id} chunk={c} />)` plus a `<div ref={bottomRef} />` sentinel.
- `useEffect(() => bottomRef.current?.scrollIntoView({block: "end"}), [transcript.length])`.
- Empty state (when `transcript.length === 0`): muted text "Start recording to see the transcript." or, if `isRecording`, "Listening..."

Complexity: medium.
Depends on: step 8.

### Step 10. MicButton component

File: `frontend/components/transcript/MicButton.tsx`

Replace the placeholder:
- Consume `isRecording`, `micPermission`, `recorderError` from session store.
- Consume `groqApiKey` via `useGroqKey`.
- Consume `useRecorder()`.
- Local state: `isRequesting` (during `getUserMedia`).
- Visual: circular button using shadcn Button with `rounded-full size-20` plus state color classes:
  - idle: `bg-blue-500 hover:bg-blue-600` + `Mic` icon from lucide-react.
  - requesting: same as idle plus `Loader2` spinning.
  - recording: `bg-red-500 hover:bg-red-600` + `Mic` + `mic-pulse` class from `globals.css`.
  - denied or error-autostop: `bg-muted text-muted-foreground` disabled.
- Click handler:
  - if `isRecording`: `await recorder.stop()`.
  - else: if `groqApiKey === ""`, toast with `action` button linking to `/settings`; return.
  - else: `setIsRequesting(true)`; `await recorder.start()`; `setIsRequesting(false)`.
- Below the button, status text matching the prototype:
  - idle: "Stopped. Click to resume."
  - recording: "Listening... transcript updates every 30s."
  - denied: "Microphone blocked. Enable access in browser settings."
  - error-autostop: "Recording stopped after 3 failed transcriptions. Reload to try again."
- Wrap the button in shadcn `Tooltip` when in denied state with the same explanation.

Complexity: medium.
Depends on: steps 4 and 7.

### Step 11. TranscriptPanel wiring

File: `frontend/components/transcript/TranscriptPanel.tsx`

- Make it a client component (`"use client"`). It reads store state.
- Compute status string:
  - `recorderError === "auto-stopped"` → "ERROR"
  - `micPermission === "denied"` → "DENIED"
  - `isRecording` → a span `<><span className="text-red-500">•</span> RECORDING</>`
  - else → "IDLE"
- Pass to `ColumnHeader right={...}`.

Complexity: low.
Depends on: steps 4, 7, 9, 10.

### Step 12. Shadcn primitives check

All primitives used (Button, ScrollArea, Tooltip, Card) are already installed. Icons come from lucide-react which is already a dependency. No `npx shadcn@latest add` needed. If a type error reveals a missing one, install it on the spot.

Complexity: trivial.
Depends on: nothing.

## Dependency graph

```
1 config              2 groq_client       3 transcribe route
                          ↑                     ↑
                          └───── depends ───────┘

4 store   5 audio   6 api.ts
   ↑         ↑         ↑
   └───── 7 useRecorder
                ↑
   8 TranscriptChunk
        ↑
   9 TranscriptFeed
                 ↑
   10 MicButton (depends on 4, 7)
                 ↑
   11 TranscriptPanel (depends on 4, 7, 9, 10)
```

Safe build order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12.

## Commands to run after each layer

After backend (steps 1-3):
```
cd backend && source .venv/bin/activate
ruff check app && mypy app && pytest
```

After frontend foundation (steps 4-7):
```
cd frontend && npm run typecheck && npm run lint
```

After frontend UI (steps 8-11):
```
cd frontend && npm run typecheck && npm run lint
# then npm run dev and smoke-test manually
```

## Risks and unknowns

1. **Safari MIME type.** MediaRecorder in Safari produces `audio/mp4`, not `audio/webm`. The `pickRecorderMimeType()` helper covers it and `content_type` is forwarded all the way to Groq. Low risk, pre-mitigated.
2. **React Strict Mode double-invoke.** Start and stop are imperative handlers called from click events, not from `useEffect` on mount. So Strict Mode's double-render does not double-invoke the recorder. Low risk.
3. **Chunk POST ordering.** If network latency differs across two in-flight POSTs, chunk N+1 can arrive before chunk N on the server. They append in arrival order, not capture order. On a healthy connection the skew is negligible. If it shows up in testing, we will add a client-side sequence number and reorder at append time. Flagged, not fixed now.
4. **jsdom has no MediaRecorder.** Phase 6 tests must mock it. Not a Phase 5 blocker.
5. **Groq `response_format=text` may change.** Low probability. If we see JSON coming back, we swap to `response_format=json` and read `payload["text"]`. Three-line fix.
6. **Partial-chunk duration on stop is wall-clock approximated.** The `Date.now()` delta between `recorder.start()` and `recorder.stop()` can skew by tens of ms from actual audio length. Inside the 2s minimum check it does not matter.
7. **No re-arm after auto-stop.** Recovery requires a page reload. Documented in `out-of-scope.md`. Could be a follow-up feature.

## What Phase 5 will produce

- Twelve file edits (eight frontend, four backend).
- No new dependencies added; no new shadcn primitives installed unless a miss surfaces during implementation.
- A working mic-to-transcript flow against real Groq for anyone with a key pasted in Settings.
- All typecheck, lint, and existing tests still pass. No new tests in Phase 5 (that is Phase 6).

## What Phase 5 will NOT produce

- Tests (Phase 6).
- Prompt content for suggestions or chat (separate feature).
- Any suggestion or chat behavior (separate features).
