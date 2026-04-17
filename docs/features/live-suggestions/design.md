# Design

## Component tree

```
SuggestionsPanel
  ColumnHeader              right: "N BATCHES"
  Toolbar row
    ReloadButton            disabled while isLoadingSuggestions
    Countdown               "auto-refresh on next chunk"
  Body
    HintCard                "Suggestions appear here once recording starts." (pre-first-batch)
    ErrorCard               visible when suggestionError != "none"
    Skeletons               visible when isLoadingSuggestions
    Batches (newest first)
      SuggestionBatch
        BatchDivider         "— BATCH N · HH:MM:SS AM/PM · [moment label] —"
        SuggestionCard[]
          TypeBadge          colored per type
          preview            text-sm leading-relaxed
        (on click → appendChatMessage user with sourceSuggestion)
    WaitingIndicator         "waiting for more conversation..." (skip-API state)
```

## State

### Session store additions

`frontend/lib/store.ts`:

```ts
type SuggestionError = "none" | "failing" | "key-invalid";

type SessionState = {
  // existing
  suggestionBatches: SuggestionBatch[];
  isLoadingSuggestions: boolean;
  lastRefreshAt: number | null;

  // new
  suggestionError: SuggestionError;
  setSuggestionError: (error: SuggestionError) => void;
};
```

The consecutive-failure counter lives in `useAutoRefresh` as a ref, not in the store. Only the hook reacts to it.

### Settings store additions

`frontend/lib/settings-store.ts`:

Replace `suggestionContextWindowSeconds: number` with `suggestionContextChunkCount: number` (default 3). Keep `refreshIntervalSeconds` for the countdown display (default 30 since that is the expected chunk cadence).

### Type additions

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
```

`Suggestion` stays as it is (`id`, `type`, `preview`, `reasoning`). The `reasoning` is preserved for the chat feature; it is not rendered by this feature.

## Data flow

### Auto-refresh (chunk-driven)

```
transcript.length changes (new chunk landed)
  → useAutoRefresh effect fires
  → guard: if isLoadingSuggestions, return (chunk is coalesced into next cycle; see edge cases)
  → setLoadingSuggestions(true)
  → apiKey = settings.groqApiKey
  → if apiKey === "": setSuggestionError("key-invalid"); setLoadingSuggestions(false); return
  → previousBatch = suggestionBatches[0] or null
  → lastN = transcript.slice(-suggestionContextChunkCount)
  → sessionDurationMs = recordingStartedAt ? Date.now() - recordingStartedAt : 0
  → fetchSuggestions({
       apiKey,
       transcript: lastN,
       promptTemplate: settings.suggestionPrompt,
       contextChunkCount: settings.suggestionContextChunkCount,
       sessionDurationMs,
       previousSuggestions: previousBatch?.suggestions.map(s => ({type, preview})) ?? [],
     })
  → on success:
       addSuggestionBatch({id, timestamp, momentType, suggestions})
       setSuggestionError("none")
       failureCountRef = 0
  → on failure:
       failureCountRef += 1
       if err.status === 401: setSuggestionError("key-invalid")
       else if failureCountRef >= 3: setSuggestionError("failing")
  → finally:
       setLoadingSuggestions(false)
       if pendingManualRefreshRef: pendingManualRefreshRef = false; schedule a manual refresh
```

### Manual refresh (reload button)

```
User clicks ReloadButton
  → if isLoadingSuggestions:
       pendingManualRefreshRef = true (queued; will fire on completion)
       return
  → await recorder.flushNow() (no-op if not recording)
       this triggers a transcript chunk landing, which WILL trigger auto-refresh naturally
  → BUT: to avoid double-firing, the manual refresh sets manualInFlightRef = true;
         the auto-refresh checks manualInFlightRef and skips if set.
  → fetchSuggestions(...)  (same call as auto-refresh)
  → manualInFlightRef = false
```

Implementation cleanup: actually simpler to let `flushNow()` return the resulting transcript chunk (or null). The manual refresh path then waits for the flush and fires one explicit `fetchSuggestions` call, while the auto-refresh's `transcript.length` effect is suppressed for this one tick by setting a `suppressNextAutoRefreshRef`. See the hook implementation in Phase 4.

### Suggestion card click

```
User clicks a SuggestionCard
  → addChatMessage({
       id: uuid,
       role: "user",
       content: suggestion.preview,
       timestamp: Date.now(),
       sourceSuggestion: { type: suggestion.type, preview: suggestion.preview },
     })
  → chat-with-streaming feature will later react to this new user message.
```

For this feature, we simply append the user message. No streaming yet.

## `flushNow()` mechanics

New method on `useRecorder`:

```ts
async function flushNow(): Promise<void> {
  if (!useSessionStore.getState().isRecording) return;
  // Cancel the pending rotation. We will restart the recorder ourselves.
  clearRotationInterval();
  const blob = await closeRecorderForBlob();
  const durationMs = Date.now() - chunkStartRef.current;
  if (useSessionStore.getState().isRecording) {
    openRecorder();
    intervalRef.current = setInterval(() => { void rotate(); }, CHUNK_INTERVAL_MS);
  }
  await postChunk(blob, durationMs);
}
```

Points:
1. Clearing the interval first prevents a concurrent `rotate()` firing while we mid-flush.
2. Restarting the interval after opening the new recorder keeps the 30s cadence alive.
3. `postChunk()` is awaited so callers know when the transcript is updated.
4. If the chunk is under 2s or gets filtered, `postChunk()` still resolves; the manual refresh falls through to fire a suggestion on the existing transcript.

## Countdown

The prototype's "auto-refresh in Ns" chip is purely informational since our real trigger is chunk arrival, not a wall-clock timer. For display:

```
const secondsSinceLastChunk = (Date.now() - (lastChunk?.timestamp ?? recordingStartedAt ?? Date.now())) / 1000;
const countdown = Math.max(0, Math.round(30 - secondsSinceLastChunk));
```

A `useEffect` + `setInterval(1000)` updates it. If no recording is active, show `"—"` instead of a number.

## Data assembly on the backend

`backend/app/services/prompt_builder.py`:

```python
def build_suggestions_prompt(
    transcript: list[TranscriptChunk],
    prompt_template: str,
    session_duration_ms: int,
    previous_suggestions: list[dict],
) -> tuple[str, str]:
    """Return (system_prompt, user_prompt)."""
    system = prompt_template  # whatever the user configured
    transcript_block = "\n".join(
        f"[{format_clock(c.timestamp)}] {c.text}" for c in transcript
    )
    prev_block = (
        "\n".join(f"- [{s['type']}] {s['preview']}" for s in previous_suggestions)
        if previous_suggestions else "(none)"
    )
    user = (
        f"Session duration: {format_duration(session_duration_ms)}\n"
        f"\n"
        f"Recent transcript:\n{transcript_block}\n"
        f"\n"
        f"Previous suggestions to avoid repeating:\n{prev_block}\n"
        f"\n"
        f"Return your response as strict JSON per the schema."
    )
    return system, user
```

The USER message is assembled by the backend, not the frontend. The frontend's editable prompt is the SYSTEM message only (the "behavior" half). This split keeps the user's prompt edits focused on behavior and avoids breaking the context-injection layout.

## API contract summary

`POST /suggestions`:

Request body (new fields marked):

```json
{
  "transcript": [{"id": "...", "text": "...", "timestamp": 0}],
  "prompt_template": "system prompt from settings",
  "context_chunk_count": 3,                     // renamed from context_window_seconds
  "session_duration_ms": 120000,                // new
  "previous_suggestions": [                     // new
    {"type": "question", "preview": "..."},
    {"type": "answer", "preview": "..."}
  ]
}
```

Response body (new field marked):

```json
{
  "batch_id": "b_abc123",
  "timestamp": 1700000000000,
  "moment_type": "question_asked",               // new
  "suggestions": [
    {"id": "s_1", "type": "answer", "preview": "...", "reasoning": "..."},
    {"id": "s_2", "type": "answer", "preview": "...", "reasoning": "..."},
    {"id": "s_3", "type": "clarification", "preview": "...", "reasoning": "..."}
  ]
}
```

Full contract in `schemas.md`.

## Latency budget

Target: under 2 seconds from chunk arrival to new batch rendered.

| Step | Budget |
|---|---|
| Request assembly (frontend → backend) | 50ms |
| Prompt assembly + network to Groq | 100ms |
| Groq GPT-OSS 120B inference | 800ms to 1500ms |
| Groq → backend → frontend | 100ms |
| Render | 50ms |
| **Total** | 1.1s to 1.8s |

We do not block on the transcription path; suggestions fire independently.

## Files that change

Frontend:
- `lib/prompts.ts`: real `SUGGESTION_PROMPT` content (see `prompts.md`).
- `lib/types.ts`: add `MomentType` union, extend `SuggestionBatch` with `momentType`.
- `lib/store.ts`: add `suggestionError` field and setter.
- `lib/settings-store.ts`: replace `suggestionContextWindowSeconds` with `suggestionContextChunkCount`.
- `lib/api.ts`: update `fetchSuggestions` signature; add new request fields.
- `app/settings/page.tsx`: replace the seconds input with a chunk-count input.
- `hooks/useRecorder.ts`: add `flushNow()` method.
- `hooks/useAutoRefresh.ts`: real implementation (chunk-driven auto-refresh, manual refresh coordination, failure counting).
- `components/suggestions/SuggestionsPanel.tsx`: rewrite; renders toolbar, countdown, error card, skeletons, batches, waiting indicator.
- `components/suggestions/ReloadButton.tsx`: wire to `useAutoRefresh`'s manual refresh action, disabled during `isLoadingSuggestions`.
- `components/suggestions/SuggestionBatch.tsx`: divider + 3 cards.
- `components/suggestions/SuggestionCard.tsx`: type badge + preview + click handler.
- `components/suggestions/TypeBadge.tsx`: colored per type per prototype-notes.

Backend:
- `app/services/groq_client.py`: implement `complete_json()` against `POST /chat/completions` with `response_format={"type": "json_object"}`.
- `app/services/prompt_builder.py`: implement `build_suggestions_prompt()` per above.
- `app/routes/suggestions.py`: real implementation. Receives request, builds prompt, calls client, validates JSON, retries once on malformed, returns.
- `app/models/schemas.py`: update `SuggestionsRequest` (rename `context_window_seconds` → `context_chunk_count`, add `session_duration_ms`, `previous_suggestions`). Update `SuggestionsResponse` (add `moment_type`). Update `SuggestionBatch` (add `momentType`).

## JSON validation and retry policy

Backend receives Groq's output. Validation steps:

1. Parse as JSON. On `JSONDecodeError`: one retry with a stricter instruction appended to the USER prompt: "Your previous response was not valid JSON. Return only a JSON object. No prose."
2. Check shape: `moment_type` is one of the six canonical values; `suggestions` is a list of 1 to 3 items; each item has `type`, `preview`, `reasoning`; `type` is one of the five canonical types.
3. On any shape failure: one retry with the same stricter instruction.
4. On second failure: raise `HTTPException(502, "suggestions malformed")`. The frontend counts this as a failure.

The client accepts 1 to 3 suggestions (not strictly 3). If the model returns fewer, we render fewer. Returning 0 is treated as malformed.
