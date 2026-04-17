# Out of scope

These are intentionally not part of this feature. Some may be added later as separate features; others are permanent exclusions for the take-home.

1. **Pause.** Only start and stop exist. A paused-but-not-stopped state would add complexity with no user value at this scope.
2. **Audio level meter or waveform.** The pulsing red button is enough visual feedback.
3. **Input device picker.** The browser's default input is used. No UI for selecting a different mic.
4. **Maximum session duration cap.** A user could record indefinitely. We do not enforce a limit.
5. **Re-encoding the audio.** Whatever MediaRecorder produces by default (`audio/webm;codecs=opus` in Chrome and Edge, `audio/mp4` in Safari) is shipped as-is. Whisper Large V3 handles both.
6. **Speaker diarization.** Whisper does not separate speakers and we do not simulate it.
7. **Sentence-level chunking in the UI.** One 30-second audio chunk maps to exactly one transcript bubble, regardless of sentence boundaries.
8. **Editing the transcript after the fact.** Chunks are immutable once added.
9. **Persisting the transcript across page reloads.** Session state is in-memory only. Settings store is the only thing persisted (to localStorage).
10. **Offline queue.** If the user goes offline, chunks fail the 3-strike rule and recording stops. We do not buffer blobs for later retry.
11. **Multi-language hallucination filter.** The deny-list is English only, matching the Whisper quirks we have observed for English audio. Other languages will pass through un-filtered.
12. **Speech activity detection.** We approximate "real speech" with the 2-second minimum chunk duration and the hallucination deny-list. We do not run VAD on the client.
13. **Precise partial-chunk trimming on stop.** A mid-chunk stop ships whatever audio was captured up to that moment. We do not trim trailing silence.
14. **Chunk retry beyond once.** Failed chunks retry exactly one time. We do not queue for later retry or implement exponential backoff.
15. **Recovery from `error-autostop` without reload.** Once auto-stopped, the only way back to `idle` is a page reload. A re-arm button could be added later.
16. **Transcript search, filtering, or highlighting.** It is a scrolling list, nothing more.
17. **Speaker name, colors, or metadata per chunk.** Timestamp + text, that is all.
18. **Cancellation of in-flight transcribe requests on stop.** The final chunk and any still-in-flight earlier chunks are allowed to complete in the background and append if successful.
