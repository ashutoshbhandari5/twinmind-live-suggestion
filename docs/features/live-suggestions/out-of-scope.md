# Out of scope

These are intentionally not part of this feature.

## Deferred for future iteration

1. **Rolling summary.** The prompt strategy doc describes a summary regenerated every 2-3 minutes once a session crosses 5 minutes. We ship the last-N-chunks window first. Add summary only if long-session testing shows context loss.
2. **Per-type tuning** of context windows. For instance, `fact_check` likely benefits from a longer window. In v1 all types share the same `suggestionContextChunkCount`.
3. **Latency telemetry** visible in the UI (time from chunk to batch rendered). Useful for tuning. Not a user-facing feature.
4. **Prompt A/B experimentation framework.** The user can edit the prompt in Settings. That is the experimentation mechanism in v1.

## Permanent exclusions

5. **Streaming suggestions.** We call `complete_json`, not `stream_chat`. The response is an atomic JSON object; streaming partial JSON would force complex parsing on the client for no user benefit.
6. **Partial-batch rendering.** A batch arrives as 3 (or 1-3) suggestions atomically. We do not render cards as they arrive.
7. **Client-side uniqueness enforcement** on suggestions within a batch. The prompt should handle it; we do not post-process.
8. **Capping visible batches** for memory. Sessions are ephemeral; scroll handles it.
9. **Batch reordering or favoriting.** Batches are append-only, newest-first.
10. **Cross-session memory.** Everything resets on reload.
11. **Multi-language prompts.** The shipped prompt is English. If the transcript is in another language, the suggestions may not adapt; this is not a scored dimension.
12. **Token streaming for the batch preview.** Irrelevant since suggestions are JSON.
13. **Cancellation of in-flight suggestion requests** on prompt edits or mic stop. In-flight requests are allowed to complete and append.
14. **Suggestion card editing** or inline follow-ups. Click goes straight to chat.
15. **Batch-level feedback widgets** (thumbs up/down, "not useful"). Scoring-dimension: not tested.
16. **Structured outputs beyond JSON** (function calling, tool use). Standard `response_format=json_object` suffices.
17. **Confidence scores per suggestion.** The model does not produce reliable confidence and we would just hide them anyway.
18. **Batch headers showing the transcript excerpt that drove the batch.** Adds clutter; the batch context is implicit from the transcript timeline on the left.
