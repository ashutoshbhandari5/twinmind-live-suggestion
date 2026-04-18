# live-suggestions

Status: Complete. 106 tests pass (60 backend, 76 frontend).

## What this is

The middle column of the app. It watches the transcript, fires a suggestion request whenever a new transcript chunk lands, renders three returned suggestions as tappable cards, and stacks prior batches below. A refresh button flushes the in-progress audio chunk first, then generates a fresh batch on demand.

## Why it exists

Evaluation criteria #1, #2, and #3 all center on suggestion quality. Interviewers will judge this column live during the conversation. Mic, chat, and export exist to feed or consume it. The prompt strategy is the assignment.

## Success criteria

### Functional

1. First batch appears shortly after the first transcript chunk lands. Not on mic start, not at a fixed 20s mark.
2. Auto-refresh fires exactly once per transcript chunk arrival.
3. Manual refresh flushes any in-progress audio chunk through `/transcribe`, then requests a new batch.
4. Each batch contains exactly 3 suggestions, rendered newest-first. Older batches stay visible below.
5. Each batch shows a divider: `— BATCH N · 01:08:16 PM · Question asked —`.
6. Each suggestion is a tappable card with a colored type badge, a preview line, and a longer reasoning string held internally for the chat feature to consume.
7. Clicking a card appends a user `ChatMessage` with `sourceSuggestion` set. This feature stops there. The chat feature produces the streaming answer.
8. Skeleton loaders occupy the top batch position while a request is in flight.
9. Reload button is disabled while a request is in flight. A click during in-flight is queued and fires once the current request finishes. Clicks are not dropped.
10. Empty transcript at refresh time: skip the API call, keep prior batches visible, show a subtle "waiting for more conversation..." indicator.
11. Three consecutive failures surface a persistent error card at the top of the column with "Check your API key and try again." copy.

### Quality

1. Every preview passes the "would I click or ignore" test. Topic-only previews ("ask about their revenue") fail; concrete previews ("Their Q3 revenue grew 34% YoY to $2.1B per last earnings call") pass.
2. The model classifies the conversational moment first, then picks types that fit the moment. The classification is returned and rendered on the batch divider.
3. New batches avoid repeating prior suggestions. The previous batch is included in the request with an explicit dedup instruction.
4. Types mix with the moment. Three `answer` suggestions when a question was just asked is correct. Three `clarification` suggestions when nothing is unclear is wrong.

### Latency

1. Auto-refresh: transcript chunk landing to new batch rendered, under 2 seconds target.
2. Manual refresh: click to new batch rendered, under 3 seconds target (extra time for the flush step).

## Dependencies

Inbound (done):
- mic-and-transcription: transcript chunks and `useRecorder`.
- Settings store with `suggestionPrompt`, context fields.

Outbound (blocked by this feature):
- chat-with-streaming: suggestion-click handoff and the `previous_suggestions` data shape.
- export: suggestion batches must serialize cleanly with their `moment_type`.

## Files in this folder

- `README.md` (this file).
- `sub-features.md`: the eight sub-features.
- `design.md`: components, state, data flow, flushNow mechanics, countdown, latency.
- `edge-cases.md`: every case.
- `out-of-scope.md`: intentional exclusions including the deferred rolling summary.
- `prompts.md`: the `SUGGESTION_PROMPT` content, template variables, output schema.
- `schemas.md`: `POST /suggestions` request/response, new model fields.

## Note on the prompt

The v1 prompt shipped in this feature is a thoughtful but unverified baseline. The real iteration happens after `docs/observations.md` is filled in from three live sessions with the TwinMind product. That is an out-of-band task for the human operator, not for this feature's Phase 5. Until observations land, treat the shipped prompt as a starting point the user can edit in Settings.

## Future improvements (not in scope here)

- Rolling summary regenerated every 2-3 minutes once the session exceeds 5 minutes. Ship the "last N chunks" window first; add summary only if long-session testing shows context loss.
- Latency telemetry: time from chunk landing to batch rendered, exposed in Settings for tuning.
- Per-type tuning: different context windows per suggestion type (e.g., `fact_check` benefits from a longer window).
