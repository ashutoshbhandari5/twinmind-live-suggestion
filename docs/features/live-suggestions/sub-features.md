# Sub-features

## 1. auto-refresh-loop

Subscribes to `useSessionStore.transcript`. When `transcript.length` increments (a new chunk landed), fires a suggestion request. Sets `isLoadingSuggestions` true for the duration.

Not a wall-clock timer. Purely chunk-driven, so manual-refresh flushes produce a batch at the same rhythm as the transcript.

Lives in `frontend/hooks/useAutoRefresh.ts`.

## 2. flush-now and manual-refresh

A new method `flushNow(): Promise<void>` on `useRecorder`. Closes the current MediaRecorder, ships the partial chunk to `/transcribe`, opens a new recorder on the same MediaStream, and resolves when the chunk has landed in the store (or was filtered). Must handle the race with the 30s interval by cancelling the pending rotation.

The reload button calls `flushNow()` then triggers a manual suggestion request. If no audio is recording, `flushNow()` is a no-op and the suggestion request fires directly.

Lives in `frontend/hooks/useRecorder.ts` (flush) and `frontend/hooks/useAutoRefresh.ts` (coordinating action).

## 3. suggestions-prompt

The `SUGGESTION_PROMPT` constant in `frontend/lib/prompts.ts`. Classifies the conversational moment first, then picks three suggestions whose types fit the moment. Returns strict JSON with `moment_type` and `suggestions: [3]`.

Editable at runtime via Settings. Full content in `prompts.md`.

## 4. batch-rendering

Renders `useSessionStore.suggestionBatches` as stacked batches, newest first. Each batch has a divider row:

```
— BATCH 2 · 01:08:16 PM · Question asked —
```

Below the divider, three `SuggestionCard` components sit. Skeletons fill the top slot while a request is in flight.

Lives in `frontend/components/suggestions/SuggestionsPanel.tsx`, `SuggestionBatch.tsx`, `SuggestionCard.tsx`, `TypeBadge.tsx`.

## 5. suggestion-card-click

Clicking a card appends a user `ChatMessage` to the session store with `sourceSuggestion: {type, preview}` set. Nothing more. The chat feature later listens for messages with this shape and produces the streaming assistant response.

Lives in `frontend/components/suggestions/SuggestionCard.tsx`.

## 6. batch-dedup

Each suggestion request sends the previous batch's previews (just `type` and `preview`, not `reasoning`) as `previous_suggestions`. The prompt instructs the model not to repeat them and to continue the conversational thread instead.

First batch sends an empty array.

Lives in `frontend/lib/api.ts`, `backend/app/services/prompt_builder.py`, `frontend/lib/prompts.ts`.

## 7. transcript-window (chunk-based)

`suggestionContextChunkCount: number` in Settings, default 3. The suggestion request ships the last N transcript chunks, not the last T seconds. Chunk-based windowing is cleaner than time-based because manual flush produces sub-30s chunks and we want consistent context sizing regardless of flush cadence.

Settings screen gets a new number input. The old `suggestionContextWindowSeconds` field is replaced.

Lives in `frontend/lib/settings-store.ts`, `frontend/app/settings/page.tsx`, `frontend/lib/api.ts`.

## 8. suggestion-error-ui

A `suggestionError` field on the session store with three values: `"none" | "failing" | "key-invalid"`.

- First failure: counter increments, no visible change yet (silent retry next cycle).
- Third consecutive failure: `suggestionError` flips to `"failing"` and a persistent error card renders at the top of the middle column.
- If any failure is a 401 from upstream: `suggestionError` flips to `"key-invalid"` immediately with "Check your API key" copy.
- Next successful batch clears the error.

Toasts are suppressed for suggestion failures so we do not spam the user.

Lives in `frontend/lib/store.ts`, `frontend/components/suggestions/SuggestionsPanel.tsx`.
