# Edge cases

## Refresh timing

1. First transcript chunk lands: auto-refresh fires. First batch appears.
2. Second transcript chunk lands: auto-refresh fires. New batch prepended; first batch visible below.
3. Transcript chunk lands while a suggestion request is in flight: skip this trigger. The next chunk's arrival or a manual refresh will pick things up. We do not queue transcript-driven triggers because the new batch would be stale by the time it fires.
4. Manual refresh while recording: `flushNow()` produces a new chunk. That chunk's arrival normally triggers auto-refresh; the manual path sets `suppressNextAutoRefreshRef` and fires its own request.
5. Manual refresh while not recording: `flushNow()` is a no-op. `fetchSuggestions` fires on the existing transcript.
6. Manual refresh with empty transcript: skip the API call. Show the "waiting for more conversation..." indicator.
7. Rapid manual-refresh clicks: reload button is disabled during `isLoadingSuggestions`. A second click while disabled sets `pendingManualRefreshRef`; only one manual refresh is queued, regardless of how many times the user clicks.

## Context handling

8. Transcript has exactly one chunk: `transcript.slice(-3)` returns that one chunk. Send it. The prompt tolerates short context.
9. Transcript has thousands of chunks (long session): only last N are sent. Older chunks never reach the model in v1. Rolling summary is deferred.
10. User lowers `suggestionContextChunkCount` to 1 in Settings mid-session: next request uses only the last 1 chunk. Intentional.
11. User sets `suggestionContextChunkCount` to 0: treated as invalid, fall back to default 3. Settings input enforces `min=1`.

## Moment classification

12. Model returns `moment_type` not in the canonical set (e.g., "other"): treated as malformed, retry once, then fail.
13. Model returns `moment_type: "idle"` with three generic conversation-starter suggestions: render them normally with an "Idle" label on the divider. This is valid.
14. Two consecutive batches both classify as `claim_made`: fine. The batch divider shows the label on each. Dedup instruction in the prompt tries to keep the specific suggestions different.

## Suggestion shape

15. Model returns 2 suggestions instead of 3: accept and render two cards. Do not retry.
16. Model returns 4 or more suggestions: treated as malformed, retry once, then accept the first 3 on the second successful response (or fail).
17. Model returns 0 suggestions: treated as malformed, retry once, then fail.
18. Model returns a suggestion with missing `reasoning`: accept (UI does not render reasoning), but log a warning backend-side.
19. Model returns a suggestion `type` not in the canonical set: malformed, retry, then fail.
20. Model returns duplicate suggestions within a single batch: accept; the prompt should prevent this but we do not enforce uniqueness client-side.

## Dedup

21. First batch (no previous): `previous_suggestions: []`. Prompt handles this gracefully with "no prior batch".
22. Previous batch happens to be identical to what the model wants to return this time: prompt's dedup instruction should steer the model away; if it still returns duplicates, accept. Not worth fighting the model.
23. Dedup payload is large (previous batch had verbose previews): we only send `type` and `preview` (not `reasoning`), keeping the payload small.

## Failures

24. Groq 401 on first attempt: frontend sets `suggestionError: "key-invalid"` immediately. Error card shows "Check your Groq API key in Settings." No retry.
25. Groq 429: counts as one failure. Retry happens on next auto-refresh trigger (next chunk arrival), not immediately.
26. Groq 5xx: counts as one failure. Same cycle.
27. Groq timeout: counts as one failure.
28. Three consecutive failures: `suggestionError: "failing"`. Error card with "Suggestions are failing. Check your connection or key." No auto-stop of the recorder; the transcript keeps flowing.
29. Successful batch after an error state: `suggestionError` clears to `"none"`. Error card disappears.
30. Network fully offline: all requests fail; the three-strike flips `failing`. The user has to reload to recover.

## Malformed JSON

31. Groq returns markdown-wrapped JSON (```json ...```): backend strips fences before parsing. If stripping fails, retry once.
32. Groq returns valid JSON but with the three canonical fields at the top level AND extra keys: extra keys are ignored.
33. Groq returns JSON in a different shape entirely (e.g., `{"recommendations": [...]}`): malformed, retry with stricter instruction.

## UI state

34. SuggestionsPanel mounts before any transcript: shows hint card.
35. Hint card disappears once `suggestionBatches.length > 0`.
36. Skeletons appear only when `isLoadingSuggestions` is true.
37. Multiple batches stacked, no cap. Users can scroll. No pagination.
38. Batch dividers use the chunk timestamp, formatted as `HH:MM:SS AM/PM` matching the prototype.
39. Type badge color per prototype-notes:
    - question → blue
    - talking_point → purple
    - answer → green
    - fact_check → amber
    - clarification → cyan

## Concurrency

40. Auto-refresh fires; user clicks reload before response lands: reload is disabled, so the click is a no-op visually. If the click was registered before disable took effect, `pendingManualRefreshRef` catches it.
41. User edits the prompt in Settings between an auto-refresh fire and its response arrival: the next request uses the new prompt. The in-flight request uses the old prompt. Intentional; we do not cancel in-flight requests on prompt edits.
42. User toggles mic off, then clicks reload: `flushNow()` returns immediately (not recording). Request fires on existing transcript. Valid.
43. `recordingStartedAt` is null when an auto-refresh somehow fires (should not happen since no chunks exist): `sessionDurationMs` defaults to 0. Prompt handles it.

## State reset

44. User hits Reset on settings: `suggestionContextChunkCount` back to 3, `suggestionPrompt` back to the shipped constant. Next request uses the new values.
45. Page reload mid-session: all batches lost (session store is in-memory). Settings preserved. Expected behavior.

## Card click

46. User clicks a card while `isLoadingSuggestions`: card click is enabled regardless. Adds the user `ChatMessage`. Chat feature will handle whatever happens next.
47. User clicks the same card twice: two user `ChatMessage`s are appended. The chat feature decides whether to produce two responses or deduplicate.
48. User clicks a card in an older batch: same behavior. Any card in any batch is tappable.
