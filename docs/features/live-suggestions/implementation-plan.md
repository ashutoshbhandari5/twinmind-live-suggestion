# Implementation plan

Status: Phase 4. Awaiting plan review gate.

## Ordering principle

Backend first (standalone testable with curl), then frontend foundation (types, stores, api client, prompts), then the orchestration hook, then UI components, then Settings UI. Within each layer, the lowest-level file goes first. Every step leaves the tree compilable and type-safe.

## Sequence

### Backend

#### 1. Update Pydantic schemas

File: `backend/app/models/schemas.py`

Add `MomentType` literal. Add `PreviousSuggestion`. Extend `SuggestionBatch` with `moment_type`. Replace `context_window_seconds` and `session_started_at` on `SuggestionsRequest` with `context_chunk_count`, `session_duration_ms`, `previous_suggestions`. Extend `SuggestionsResponse` with `moment_type`.

Complexity: low.
Depends on: nothing.

#### 2. Implement `GroqClient.complete_json`

File: `backend/app/services/groq_client.py`

Replace the `NotImplementedError` stub. Signature unchanged:

```python
async def complete_json(self, system_prompt: str, user_prompt: str) -> str
```

Logic:
- POST `f"{GROQ_API_BASE}/chat/completions"` with `Authorization: Bearer {api_key}`.
- Body:
  ```python
  {
    "model": GROQ_CHAT_MODEL,
    "messages": [
      {"role": "system", "content": system_prompt},
      {"role": "user", "content": user_prompt},
    ],
    "response_format": {"type": "json_object"},
    "temperature": 0.3,
  }
  ```
- Timeout: `SUGGESTIONS_TIMEOUT_SECONDS` (15s).
- `response.raise_for_status()`.
- Return `response.json()["choices"][0]["message"]["content"]` as the raw JSON string. Do not parse here; the route handles parsing and retry.

Complexity: medium.
Depends on: step 1 (uses `GROQ_CHAT_MODEL`, `SUGGESTIONS_TIMEOUT_SECONDS` which already exist).

#### 3. Implement `build_suggestions_prompt`

File: `backend/app/services/prompt_builder.py`

Replace the stub. New signature:

```python
def build_suggestions_prompt(
    transcript: list[TranscriptChunk],
    prompt_template: str,
    session_duration_ms: int,
    previous_suggestions: list[PreviousSuggestion],
) -> tuple[str, str]:
```

Returns `(system_prompt, user_prompt)`. Logic:
- `system = prompt_template` (used as-is; validation that it is non-empty happens in the route).
- `user = "Session duration: {mmss}\n\nRecent transcript:\n{lines}\n\nPrevious suggestions to avoid repeating:\n{prev}\n\nClassify the moment, then return the JSON object per the schema. Output JSON only."`.
- Helper `_format_duration(ms: int) -> str` returns `"Xm Ys"`.
- Helper `_format_clock(ms: int) -> str` returns `"HH:MM:SS AM/PM"` from millis since epoch.
- Transcript lines: `"[{clock}] {text}"` joined by `"\n"`.
- Previous suggestions block: `"- [{type}] {preview}"` joined by `"\n"`, or `"(none)"`.

Complexity: low-medium.
Depends on: step 1.

#### 4. Rewrite the `/suggestions` route

File: `backend/app/routes/suggestions.py`

Replace the mock implementation. Logic:
- Validate: if `x_groq_api_key == ""`: raise 401 "missing groq key".
- Validate: if `prompt_template == ""`: raise 400 "prompt template is empty".
- Validate: if `transcript` is empty: raise 400 "transcript is empty".
- Clamp `context_chunk_count` to `[1, 50]`.
- Build `(system, user)` via `build_suggestions_prompt`.
- Client call with retry wrapper:
  - Attempt 1: call `client.complete_json(system, user)`, parse JSON, validate shape. On success, return.
  - Attempt 2 (only on JSON or shape failure, not on network failure): call again with `user + "\n\nYour previous response was not valid JSON matching the schema. Return only a single JSON object. No prose, no markdown fences."`. Same validation. On success, return. On failure, raise 502 "suggestions malformed".
- Error mapping (same helper as transcribe): `httpx.TimeoutException` → 504, `httpx.HTTPStatusError` → 401/413/429/502 per status, `httpx.HTTPError` → 502.
- JSON shape validation: parse, optionally strip markdown fences first (regex `^```(?:json)?\n?|\n?```$`), then:
  - Top-level keys: `moment_type` in the canonical set, `suggestions` is a list of 1 to 3 items.
  - Each suggestion has `type` in canonical set, non-empty `preview`, `reasoning` (string, may be empty).
- Construct response:
  - `batch_id = "b_" + uuid4().hex[:8]`
  - `timestamp = int(time.time() * 1000)`
  - Each suggestion gets `id = "s_" + uuid4().hex[:8]`.

Complexity: high. JSON validation + retry + error mapping + shape checks.
Depends on: steps 1, 2, 3.

### Frontend foundation

#### 5. Update types

File: `frontend/lib/types.ts`

Add `MomentType` literal union. Extend `SuggestionBatch` with `momentType: MomentType`. Update `SuggestionsResponse` to include `moment_type: MomentType` (snake_case, matches backend).

Complexity: low.
Depends on: nothing.

#### 6. Extend session store

File: `frontend/lib/store.ts`

Add:

```ts
type SuggestionError = "none" | "failing" | "key-invalid";

// in SessionState:
suggestionError: SuggestionError;
setSuggestionError: (error: SuggestionError) => void;
```

Add `suggestionError: "none"` to `initialState`. Add setter. Include in `reset()`.

Complexity: low.
Depends on: nothing.

#### 7. Settings store migration

File: `frontend/lib/settings-store.ts`

Remove `suggestionContextWindowSeconds: number`.
Add `suggestionContextChunkCount: number` (default `3`).
Keep `refreshIntervalSeconds` for countdown display.

The existing persisted localStorage under key `"twinmind-settings"` will have the old field. When the store rehydrates, the missing `suggestionContextChunkCount` falls back to the default (Zustand's `persist` middleware with `merge` does this by default — deep merge of stored state into defaults). We do not need an explicit migration function. The stale `suggestionContextWindowSeconds` field will persist in localStorage but is harmless.

Complexity: low.
Depends on: nothing.

#### 8. Write SUGGESTION_PROMPT content

File: `frontend/lib/prompts.ts`

Replace `SUGGESTION_PROMPT = ""` with the full content documented in `prompts.md`. Leave `DETAILED_ANSWER_PROMPT` and `CHAT_PROMPT` empty (next features will fill them).

Complexity: low.
Depends on: nothing.

#### 9. Update API client

File: `frontend/lib/api.ts`

Change `fetchSuggestions` signature:

```ts
export async function fetchSuggestions(args: {
  apiKey: string;
  transcript: TranscriptChunk[];
  promptTemplate: string;
  contextChunkCount: number;
  sessionDurationMs: number;
  previousSuggestions: { type: SuggestionType; preview: string }[];
}): Promise<SuggestionsResponse>
```

Body maps to snake_case field names: `transcript`, `prompt_template`, `context_chunk_count`, `session_duration_ms`, `previous_suggestions`. Parse the response as-is (snake_case fields `batch_id`, `moment_type` stay as-is in `SuggestionsResponse` type).

Complexity: low.
Depends on: step 5.

#### 10. Add `flushNow()` to `useRecorder`

File: `frontend/hooks/useRecorder.ts`

Add new method to the return value:

```ts
async function flushNow(): Promise<void> {
  if (!useSessionStore.getState().isRecording) return;
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

Return `{ start, stop, flushNow }` instead of `{ start, stop }`. Update the `RecorderHandle` type.

Complexity: low-medium. Similar shape to `stop()` but re-opens the recorder afterward.
Depends on: nothing (existing mic-and-transcription is the base).

### Orchestration hook

#### 11. Implement `useAutoRefresh`

File: `frontend/hooks/useAutoRefresh.ts`

Replace `export {}` with:

```ts
export function useAutoRefresh(recorder: RecorderHandle): {
  manualRefresh: () => Promise<void>;
};
```

State in refs:
- `failureCountRef: number` (consecutive failures; resets on success).
- `pendingManualRef: boolean` (queues a manual click during in-flight).
- `suppressNextAutoRef: boolean` (set by manual refresh after `flushNow` to prevent double-fire).
- `lastSeenTranscriptLengthRef: number` (guards against double-fire on the same length).

Logic:

```ts
async function doRefresh(): Promise<void> {
  const session = useSessionStore.getState();
  if (session.isLoadingSuggestions) return;

  const settings = useSettingsStore.getState();
  const apiKey = settings.groqApiKey;
  if (!apiKey) {
    session.setSuggestionError("key-invalid");
    return;
  }

  const transcript = session.transcript;
  if (transcript.length === 0) return;  // waiting-for-conversation state

  session.setLoadingSuggestions(true);
  try {
    const prev = session.suggestionBatches[0];
    const lastN = transcript.slice(-settings.suggestionContextChunkCount);
    const sessionDurationMs = session.recordingStartedAt
      ? Date.now() - session.recordingStartedAt
      : 0;
    const previousSuggestions = prev
      ? prev.suggestions.map((s) => ({ type: s.type, preview: s.preview }))
      : [];

    const res = await fetchSuggestions({
      apiKey,
      transcript: lastN,
      promptTemplate: settings.suggestionPrompt,
      contextChunkCount: settings.suggestionContextChunkCount,
      sessionDurationMs,
      previousSuggestions,
    });

    session.addSuggestionBatch({
      id: res.batch_id,
      timestamp: res.timestamp,
      momentType: res.moment_type,
      suggestions: res.suggestions,
    });
    session.setSuggestionError("none");
    failureCountRef.current = 0;
  } catch (err) {
    failureCountRef.current += 1;
    const is401 = err instanceof Error && err.message.includes("401");
    if (is401) {
      session.setSuggestionError("key-invalid");
    } else if (failureCountRef.current >= 3) {
      session.setSuggestionError("failing");
    }
  } finally {
    session.setLoadingSuggestions(false);
    if (pendingManualRef.current) {
      pendingManualRef.current = false;
      void manualRefresh();
    }
  }
}
```

Auto-refresh subscription (React effect):

```ts
const transcriptLength = useSessionStore((s) => s.transcript.length);

useEffect(() => {
  if (transcriptLength === 0) return;
  if (transcriptLength === lastSeenTranscriptLengthRef.current) return;
  lastSeenTranscriptLengthRef.current = transcriptLength;
  if (suppressNextAutoRef.current) {
    suppressNextAutoRef.current = false;
    return;
  }
  void doRefresh();
}, [transcriptLength]);
```

Manual refresh:

```ts
async function manualRefresh(): Promise<void> {
  const session = useSessionStore.getState();
  if (session.isLoadingSuggestions) {
    pendingManualRef.current = true;
    return;
  }
  // Flush before calling to surface the freshest context.
  suppressNextAutoRef.current = true;
  await recorder.flushNow();
  await doRefresh();
}
```

Return `{ manualRefresh }`.

Error-message 401 detection note: `lib/api.ts` currently throws `Error("suggestions failed: 401")`. We rely on substring match. Brittle but acceptable; if it becomes an issue, promote to a typed error in `api.ts`.

Complexity: high. The subscription + dedupe + manual coordination + failure escalation have to compose cleanly.
Depends on: steps 5, 6, 7, 8, 9, 10.

### Frontend UI

#### 12. TypeBadge with per-type colors

File: `frontend/components/suggestions/TypeBadge.tsx`

Extend the existing `TypeBadge` with a color map per prototype-notes:
- question → blue
- talking_point → purple
- answer → green
- fact_check → amber
- clarification → cyan

Use shadcn `Badge` with conditional class names:

```tsx
const COLORS: Record<SuggestionType, string> = {
  question: "border-blue-500/40 text-blue-300 bg-blue-500/10",
  talking_point: "border-purple-500/40 text-purple-300 bg-purple-500/10",
  answer: "border-green-500/40 text-green-300 bg-green-500/10",
  fact_check: "border-amber-500/40 text-amber-300 bg-amber-500/10",
  clarification: "border-cyan-500/40 text-cyan-300 bg-cyan-500/10",
};
```

Display text: replace underscore with space and title-case (e.g., `talking_point` → `TALKING POINT`).

Complexity: low.
Depends on: step 5.

#### 13. SuggestionCard

File: `frontend/components/suggestions/SuggestionCard.tsx`

Replace placeholder:
- Props: `{ suggestion: Suggestion }`.
- Renders shadcn `Card` with hover/active states (cursor-pointer, hover:bg-muted/50).
- Inside: `TypeBadge` + preview text (`text-sm leading-relaxed`).
- Click handler: append a user `ChatMessage` to the session store with `sourceSuggestion: { type, preview }`:

```tsx
function handleClick() {
  useSessionStore.getState().addChatMessage({
    id: crypto.randomUUID(),
    role: "user",
    content: suggestion.preview,
    timestamp: Date.now(),
    sourceSuggestion: { type: suggestion.type, preview: suggestion.preview },
  });
}
```

- The whole card is a `<button>` with `type="button"` and the click handler. Use `text-left` so the preview reads naturally.

Complexity: low.
Depends on: step 12.

#### 14. SuggestionBatch

File: `frontend/components/suggestions/SuggestionBatch.tsx`

Replace placeholder:
- Props: `{ batch: SuggestionBatch; index: number }` where `index` is the 1-based batch number.
- Renders a divider row: `— BATCH {index} · {clock} · {label} —` centered with horizontal lines left and right.
- Below the divider: map `batch.suggestions` to `SuggestionCard` components stacked with `gap-2`.
- Helpers:
  - `clock(ts)` via `Intl.DateTimeFormat("en-US", {hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true})`.
  - `MOMENT_LABELS: Record<MomentType, string>` maps `question_asked` → `"Question asked"`, etc.

Complexity: low.
Depends on: steps 5, 13.

#### 15. ReloadButton wiring

File: `frontend/components/suggestions/ReloadButton.tsx`

Accept props `{ onRefresh: () => Promise<void>; disabled: boolean }`. The parent (`SuggestionsPanel`) passes `manualRefresh` from `useAutoRefresh` and `isLoadingSuggestions` from the store.

Button copy: `"↻ Reload suggestions"`. Use the existing shadcn `Button` (variant="outline", size="sm"). Wrap the ↻ in a lucide-react `RotateCw` icon for polish.

Complexity: low.
Depends on: step 11.

#### 16. Rewrite SuggestionsPanel

File: `frontend/components/suggestions/SuggestionsPanel.tsx`

Full rewrite as a client component. Consume from stores:
- `suggestionBatches`, `isLoadingSuggestions`, `suggestionError`, `transcript` (length for empty-state detection), `recordingStartedAt` (for countdown base).

Content (top to bottom):
1. `ColumnHeader` with `right={suggestionBatches.length} BATCHES`.
2. Toolbar row:
   - `ReloadButton` on the left.
   - Countdown text on the right: "auto-refresh in Ns" or "—".
3. Body (scrollable container):
   - `ErrorCard` if `suggestionError !== "none"` (copy depends on which error).
   - `SkeletonBatch` if `isLoadingSuggestions` (three shadcn `Skeleton` components in a batch layout).
   - `HintCard` if `suggestionBatches.length === 0 && !isLoadingSuggestions && transcript.length === 0`: "Suggestions appear here once recording starts."
   - WaitingIndicator if `suggestionBatches.length > 0 && transcript.length === 0` is impossible (transcript cannot shrink); skip this branch.
   - `WaitingIndicator` shown below the latest batch when the last refresh was skipped (we will not track this in v1; accept that this is a minor UI polish deferred).
   - Batches mapped: `suggestionBatches.map((b, i) => <SuggestionBatch batch={b} index={suggestionBatches.length - i} />)` so the newest is batch N and older batches count down.

Also instantiates the hook: `const { manualRefresh } = useAutoRefresh(recorder)`. The `recorder` needs to be passed in from a parent that holds the same instance as `MicButton`, OR we rework `useRecorder` to be a singleton.

**Design decision to raise**: currently `useRecorder` returns a new handle each render and each consumer calls its own `start/stop`. That is fine because refs hold state and only one consumer (`MicButton`) exists. But `useAutoRefresh` needs to call `flushNow`, and if it uses its own `useRecorder()` instance, the refs will be different from `MicButton`'s; the flush will do nothing.

Solution: lift `useRecorder()` one level up into `TranscriptPanel`'s parent (the layout), or make it a Zustand-like singleton. Simpler path: move the `useRecorder()` invocation into `app/page.tsx` and pass the handle down to both `TranscriptPanel` (and thus `MicButton`) and `SuggestionsPanel` (and thus `useAutoRefresh`).

This is a Phase 5 implementation detail but must be flagged in the plan for review.

Complexity: medium-high. Lots of conditionals; the recorder-sharing change propagates to two other components.
Depends on: steps 6, 10, 11, 13, 14, 15.

#### 17. Recorder-sharing plumbing

Files:
- `frontend/app/page.tsx`: call `useRecorder()` here, pass the handle to both `TranscriptPanel` and `SuggestionsPanel` via props. Make `page.tsx` a client component (`"use client"`).
- `frontend/components/transcript/TranscriptPanel.tsx`: accept `recorder` prop, pass to `MicButton`.
- `frontend/components/transcript/MicButton.tsx`: accept `recorder` prop instead of calling `useRecorder()` itself.
- `frontend/components/suggestions/SuggestionsPanel.tsx`: accept `recorder` prop, pass to `useAutoRefresh`.

Complexity: low per file, but touches several. Strict-mode safe because `useRecorder`'s start/stop are imperative.

Depends on: step 10.

### Settings UI

#### 18. Settings page update

File: `frontend/app/settings/page.tsx`

Replace the "Suggestion window (s)" input with a "Suggestion window (chunks)" input. Bind to `suggestionContextChunkCount`. `min=1`, `max=50`, default `3`. Drop the old `detailedAnswerContextMode` select for now (it is specific to the chat feature and we can adjust its semantics when we build chat). Actually, leave it — it is harmless, and touching it is out of scope here.

Complexity: low.
Depends on: step 7.

## Dependency graph

```
1 schemas ── 2 groq_client.complete_json ── 4 /suggestions route
      └── 3 prompt_builder ──────────────────┘

5 types ── 6 store
      ├── 9 api.ts
      └── 8 prompts.ts

7 settings-store ── 18 settings UI

10 useRecorder.flushNow ── 17 page.tsx plumbing
                                 ├── MicButton updated
                                 └── TranscriptPanel updated

11 useAutoRefresh (needs 5, 6, 7, 9, 10)

12 TypeBadge ── 13 SuggestionCard ── 14 SuggestionBatch

15 ReloadButton (needs 11)

16 SuggestionsPanel (needs 6, 11, 14, 15, 17)
```

Safe build order: 1, 2, 3, 4 → 5, 6, 7, 8, 9 → 10 → 11 → 12, 13, 14, 15 → 17 → 16 → 18.

## Commands after each layer

After backend (1-4):
```
cd backend && source .venv/bin/activate
ruff check app && mypy app && pytest
```

After frontend foundation (5-9):
```
cd frontend && npm run typecheck && npm run lint
```

After recorder + hook (10-11):
```
cd frontend && npm run typecheck && npm run lint
```

After UI + plumbing (12-17):
```
cd frontend && npm run typecheck && npm run lint && npm run test
```

After settings (18):
```
cd frontend && npm run typecheck && npm run lint && npm run test
# then npm run dev and smoke-test manually
```

## Manual verification checklist (before Phase 6)

- [ ] Hint card visible before first chunk lands.
- [ ] First batch appears within ~2s of the first transcript chunk.
- [ ] Batch divider reads `— BATCH 1 · HH:MM:SS AM/PM · Question asked —` (or equivalent).
- [ ] Each batch has 1-3 cards, each with a colored type badge and a concrete preview.
- [ ] New batches prepend above older batches.
- [ ] Reload button disabled while loading; skeleton appears at top.
- [ ] Click reload during loading: nothing visible changes; after current request completes, a manual refresh fires (visual: another skeleton then a new batch).
- [ ] Invalid Groq key: error card says "Check your Groq API key in Settings."
- [ ] Network offline: after three consecutive failed chunks, error card says "Suggestions are failing."
- [ ] Click a card: nothing visually happens in the middle column (chat column will respond later). Inspect Zustand to confirm the chat message was appended.
- [ ] Settings: change chunk count to 1, next batch uses only the latest chunk.

## Risks and unknowns

1. **Groq `response_format: json_object` on `gpt-oss-120b`.** If unsupported, the request fails with a 400. Mitigation: the retry instruction and our fence-stripping regex already handle markdown-wrapped JSON, so we can drop `response_format` and rely on the prompt alone. Plan for both paths; try json_object first.
2. **Recorder singleton plumbing (step 17).** Moving `useRecorder()` up to `page.tsx` forces `page.tsx` to become a client component. Minor but changes the SSR story. Acceptable for a take-home.
3. **localStorage stale field.** Users who loaded the app before this feature have `suggestionContextWindowSeconds` in localStorage. Zustand's default merge keeps both fields; the removed field is ignored. No migration needed.
4. **Strict Mode double-effect.** The `useAutoRefresh` effect is guarded by `doRefresh`'s internal `isLoadingSuggestions` check, which reads fresh state from `getState()`. Strict Mode safe.
5. **Chunk-ordering issues** (carried from mic-and-transcription). If two chunks arrive out of order on a congested network, the suggestion request for the later-arriving one uses a stale `transcript.slice(-N)`. Low risk in practice.
6. **401 detection via string match.** `lib/api.ts` throws an `Error` with the status in the message. String-matching on `"401"` is brittle. If it becomes a problem we promote to a typed error class in `api.ts`. For v1, acceptable.
7. **Card click adds to chat but chat feature is still stubbed.** User clicks will silently "succeed" with no visible chat response until chat-with-streaming is built. Flagged so this is not a surprise during manual verification.
8. **`moment_type` rendering label** for `idle` might feel wrong mid-session. If interviewers see too many "Idle" dividers, the classification taxonomy needs tuning. Addressed in the prompt iteration pass (after observations.md).
9. **Temperature 0.3 hardcoded.** Not exposed in Settings (by design, per prompts.md). If this hurts variety, bump it in code after observations.

## What Phase 5 will produce

- 18 file edits (4 backend, 14 frontend including the shared-recorder plumbing).
- No new dependencies, no new shadcn primitives, no new pip packages.
- A working live-suggestions column end-to-end against real Groq once a key is pasted.
- All existing tests (26 backend, 46 frontend) continue to pass.

## What Phase 5 will NOT produce

- Tests for the new code (Phase 6).
- The chat feature (separate feature; suggestions-click handoff is scaffolded but not streamed).
- The export button UI (separate feature).
- Prompt iteration based on `docs/observations.md` (out-of-band human task).
