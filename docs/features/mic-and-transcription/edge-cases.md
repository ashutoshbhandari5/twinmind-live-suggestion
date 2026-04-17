# Edge cases

Every case below must be handled explicitly. Phase 6 tests will target this list.

## Mic permission

1. First-ever click: the browser permission prompt fires. User grants. Recording begins.
2. First-ever click, user denies. `micPermission` becomes `"denied"`. Toast fires. Button is disabled thereafter with a tooltip.
3. Permission was previously denied at the OS or browser level. `getUserMedia` rejects immediately on the first click. Same behavior as case 2.
4. User revokes permission mid-session from browser UI. The active MediaStream may end; the next `getUserMedia` call on restart fails. Treat as a fresh denial.
5. User grants permission, stops recording, then clicks start again. No new prompt. `getUserMedia` resolves immediately. Recording resumes.

## API key

6. Click with `groqApiKey === ""`. No `getUserMedia` call, no recording. Toast shows "Add your Groq key in Settings" with a link.
7. API key is valid at start but becomes invalid mid-session (user edits it in Settings or Groq rotates it). Groq returns 401. Backend returns 401. Frontend treats it as a chunk failure, retries once, then counts it toward the 3-strike auto-stop.
8. User pastes a malformed key with the right prefix. Groq 401. Same as case 7.

## Recording lifecycle

9. Stop exactly at a 30s boundary. The recorder closes naturally, no partial blob, `isRecording` flips to false.
10. Stop 12 seconds into a chunk. The current MediaRecorder is stopped, the 12s blob is shipped, the result appears.
11. Stop within the first 2 seconds of a chunk. The blob is under the minimum, not POSTed. No bubble appears.
12. Start, stop, start again. Transcript appends silently with no divider. Timestamps are monotonically increasing because `Date.now()` is used.
13. Rapid toggling (start, stop, start, stop within a few seconds). Each cycle independently respects the 2s minimum and hallucination filter. Most toggles produce nothing.

## Transcribe failures

14. Network offline. Fetch throws. Retry once. Still offline. Toast and increment counter.
15. Groq 401 (invalid or missing key). Same retry-once flow. Toast: "Groq rejected the key. Check Settings." Counts toward 3-strike.
16. Groq 429 (rate limit). Retry once after a 1-second delay. If still rate-limited, toast and count.
17. Groq 5xx. Retry once. Still failing, toast and count.
18. Groq timeout (>30s). Backend returns 504. Retry once. Still failing, toast and count.
19. Three consecutive chunk failures of any kind. Call `stop()`, `setRecorderError("auto-stopped")`, persistent banner above the button.
20. Two failures then a success. Counter resets to 0. Recording continues normally.
21. Transcribe succeeds but returns text that is only a hallucination. Backend filters it to empty. Frontend does not count it as a failure. Counter stays at its current value.

## Hallucination filter

22. Whisper returns `"Thank you."` for a silent chunk. Backend returns `{text: ""}`. No bubble.
23. Whisper returns `"THANK YOU."` (caps). Lowercased comparison catches it.
24. Whisper returns `"Thanks for watching. Actually, the Q3 numbers grew 34%."`. Mixed output. Not filtered. Passes through as-is. This is intentional.
25. Whisper returns only whitespace or `"."`. Filtered to empty.

## Audio edge cases

26. User is silent for a full 30s chunk. Whisper typically returns empty or a hallucination. Filtered. No bubble.
27. User's microphone picks up only background noise for 30s. Whisper may return noise-adjacent phrases. Not in deny-list, so it passes through. Acceptable for MVP.
28. System input device changes (headphones unplugged) mid-recording. The active MediaStream may end. Next chunk boundary fails to restart. Treat as fresh denial flow, toast, auto-stop.
29. Browser tab is backgrounded. MediaRecorder continues. Some browsers throttle timers (setInterval may drift). 30s intervals may become 45s or longer. Not blocking for MVP; we accept the drift.

## State and navigation

30. Page reload during recording. Session store resets, recording stops implicitly (MediaStream is garbage-collected). Settings store persists (localStorage).
31. Navigation to `/settings` and back. The root layout does not remount, so the session store and the active MediaStream survive. Recording continues uninterrupted.
32. Navigation away from the app entirely (different origin). The MediaStream is terminated by the browser.

## Button state transitions

33. `idle` → click → `requesting-permission` → granted → `recording`.
34. `idle` → click → `requesting-permission` → denied → `denied`.
35. `recording` → click → `idle`.
36. `recording` → 3 failures → `error-autostop`. Only recovery is a page reload. (Acceptable for MVP.)
37. `denied` → (no recovery inside the app; user must change browser settings and reload).

## Concurrency

38. User clicks the mic twice quickly while in `requesting-permission`. The second click is a no-op (button is disabled during the prompt).
39. A 30s boundary fires while `getUserMedia` is still pending on initial start. Impossible: the interval is not set until after permission resolves.
40. A transcribe POST is still in flight when the user stops recording. The POST completes in the background; if it returns a valid text, `addTranscriptChunk` runs and appends one final bubble after stop. This is desirable.
