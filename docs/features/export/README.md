# export

Status: Complete. 229 tests pass (82 backend, 147 frontend).

## What this is

The Export button in the top bar. One click downloads a JSON file containing the full session: transcript chunks, every suggestion batch, the chat history, and a small envelope with timing metadata. All work happens client-side; no backend round-trip.

## Why it exists

Brief states the requirement directly: "A button to export the full session: transcript + every suggestion batch + full chat history with timestamps for each. JSON or plain text is fine. We use this to evaluate submissions."

This is one of the items CLAUDE.md lists as a submission failure if missing. Evaluators will use the file to inspect prompt outputs and verify the app produced what we claim.

## Success criteria

### Functional

1. Export button is always enabled (no greyed-out empty state).
2. Click triggers a file download named `twinmind-session-YYYY-MM-DD-HHMM.json` using the user's local time.
3. File is valid JSON, parseable by any standard tool.
4. File contains every transcript chunk, every suggestion batch (with their `moment_type`), every chat message (user and assistant, with `sourceSuggestion` when set).
5. Every item carries both raw `timestamp` (ms since epoch) and `timestampReadable` (local clock string).
6. Envelope at the top: `exportedAt`, `exportedAtReadable`, `appVersion`, `sessionStartedAt`, `sessionStartedAtReadable`, `sessionDurationMs`.
7. When all three arrays are empty, the file includes `"note": "No session data recorded"` at the top level.
8. The download succeeds on a fresh session (empty arrays produce a valid, small file).

### Non-functional

1. No network call. The data already lives in the browser.
2. No XSS surface: the file is a download, not rendered in the DOM.
3. No PII leakage to a server.

## Dependencies

Inbound (done):
- All three previous features populate the session store. Export reads from it.

Outbound:
- None. This is the last feature.

## Files in this folder

- `README.md` (this file).
- `sub-features.md`: the four sub-features.
- `design.md`: shape, builder, download mechanics.
- `edge-cases.md`: empty session, sessionStartedAt null, very large transcripts, browser quirks.
- `out-of-scope.md`: explicit exclusions.
- `schemas.md`: the file format and per-item shapes.

## Deliberate tradeoff

We intentionally do NOT call the backend `/export` endpoint. The browser already holds every byte of the session in Zustand; a network round-trip adds latency, a failure mode, and a server hop for nothing. The endpoint stays in the codebase for now to avoid a doc/test churn pass; a later cleanup can remove it.

## Future improvements (not in scope here)

- Plain-text or Markdown export alongside JSON.
- Clipboard copy.
- Selective export (transcript-only, chat-only).
- Redaction of API key from prompts (keys are never in the export anyway, but worth being explicit if we later embed prompts).
- Import (load a saved session).
- Server-side persistence or share-by-URL.
- Auto-export on tab close.
