# Edge cases

## Session state

1. Brand new session, button clicked immediately (recording never started, no chunks, no batches, no chat). File downloads with empty arrays plus `"note": "No session data recorded"`. `sessionStartedAt: null`, `sessionStartedAtReadable: null`, `sessionDurationMs: 0`.
2. Recording was started but no transcript chunks landed yet (within the first 30s). `transcript: []`, but `sessionStartedAt` is set. No `note` field because at least one array might still grow (we only emit `note` when all three are empty AND sessionStartedAt is null... actually emit note purely on the array-empty check; see below).
3. Recording started and stopped, then user clicks export. Snapshot includes the transcript captured so far, `sessionDurationMs` measured to "now" (export time), not to when stop was clicked.
4. User exports mid-stream while chat is still streaming. The streamed assistant message is included with whatever content has been flushed at the moment of export. Subsequent tokens are not in the file.
5. User exports while a suggestion request is in flight (`isLoadingSuggestions === true`). The current batch is not yet in `suggestionBatches`, so the file omits it. Acceptable — export captures committed state.

## Note field semantics

6. If `transcript.length === 0 && suggestionBatches.length === 0 && chatMessages.length === 0`, the file has `note: "No session data recorded"`. (`sessionStartedAt` value does not matter for the note rule.)
7. Any of the three arrays is non-empty: `note` field omitted entirely.

## Timestamps

8. Item with `timestamp: 0`: rendered as `01/01/1970, ...` (epoch). Acceptable; should not happen in practice but does not crash.
9. `sessionStartedAt: null`: `sessionStartedAtReadable: null` and `sessionDurationMs: 0`. Both null cases are explicit.
10. Local time differs from UTC: timestamps render in the user's local time, matching what they see in the UI.

## File and download

11. User clicks Export twice in quick succession: two files download. Browsers may auto-name the second `twinmind-session-...-(1).json`. Acceptable — no dedup logic.
12. User clicks Export with the browser's pop-up blocker enabled: download is blocked by the browser. We do not handle this; the user sees the browser's own warning.
13. User clicks Export while offline: works (no network involved).
14. User clicks Export from `/settings` page navigation: works because the button lives in the layout-shared header.

## Filename collisions

15. Two exports within the same minute produce identical filenames. The browser handles by appending `(1)`, `(2)`, etc. Accept.
16. User has changed system clock to the past: filename uses the new (wrong) clock. Acceptable — we trust the system clock.

## Data shape

17. Transcript chunk with empty `text` (filtered to empty server-side): never appears in the store, so never in the export.
18. Suggestion batch where the model returned only 1 or 2 suggestions: file preserves the actual count (1, 2, or 3). No padding.
19. Chat message with empty content (the placeholder bubble before the first token): rare to export at this exact moment, but if it happens, the file shows `content: ""`. No filtering.
20. Chat message with `sourceSuggestion: undefined`: the field is omitted from the JSON via standard `JSON.stringify` behavior. Reading it back returns `undefined`.
21. Chat message with `sourceSuggestion` set but missing `reasoning` (older messages from before the chat feature): exported as-is with `reasoning` omitted.

## Browser and environment

22. Safari, Chrome, Firefox latest: all support `URL.createObjectURL`, anchor `download`, and the Blob constructor we use.
23. Mobile browsers: download behavior varies; iOS Safari may open the JSON in a new tab instead of downloading. Acceptable for a desktop-first take-home.
24. JavaScript disabled: button does not work. Page does not work either. Out of scope.

## Concurrency

25. User clicks Export while clicking a suggestion card (which appends a chat message): the export snapshot is taken from a single `getState()` call, so it either includes or excludes the new message atomically. No torn read.

## App version

26. `APP_VERSION` constant out of sync with `package.json`: the file shows the constant. We rely on a manual bump at release time. Acceptable for a take-home.
