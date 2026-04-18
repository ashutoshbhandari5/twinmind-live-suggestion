# Edge cases

## Firing rules

1. User message appended while streaming is in progress: hook's guard (`isStreamingChat`) skips, so the second user message is left dangling. **Not desired.** The ChatInput and suggestion cards both disable during streaming to prevent this in the UI. If a race still happens, the message appears in the transcript but never gets a response. Acceptable for v1.
2. Two suggestion clicks in rapid succession, both before streaming starts: `lastHandledIdRef` ensures only one fires. The second click's user message is left without a response until another user turn. Accept as a v1 quirk; UI disables during streaming anyway.
3. React Strict Mode double-invoke on mount: subscription effect fires twice. `lastHandledIdRef` absorbs the second call. Safe.

## Empty and edge inputs

4. Textarea submitted with empty string: no-op, no message appended.
5. Textarea submitted with only whitespace: trimmed, treated as empty, no-op.
6. Textarea submitted with many lines of content: appended as-is, rendered as plain text in user bubble.
7. Textarea submitted with markdown syntax: rendered as plain text (user bubbles do not parse markdown, only assistant bubbles do).

## Source suggestion handling

8. Suggestion click with sourceSuggestion present: detailed-answer prompt path.
9. Typed message with no sourceSuggestion: chat prompt path.
10. Suggestion click where the suggestion has empty reasoning: still fires; backend prompt handles empty reasoning gracefully.

## Streaming lifecycle

11. Groq takes a while to send the first token: placeholder dots remain visible. First token arrives; dots replaced; cursor appears; text streams.
12. Groq sends one big chunk and then done: single flush produces the whole response. Cursor briefly appears and disappears.
13. Stream ends with the interval still queued: cleanup flushes any remaining buffer once, then clears interval. No lost tokens.
14. Client closes the tab mid-stream: backend detects disconnect via ClientDisconnect; upstream Groq stream is cancelled.

## Errors before first token

15. Groq 401 (invalid key): backend returns 401 HTTPException. Frontend catches, sets `chatError: "interrupted"`. Assistant bubble still visible but empty; pill shows.
16. Groq 429: backend returns 429. Same handling. Pill shows.
17. Groq 5xx: backend returns 502. Same handling.
18. Groq timeout: backend returns 504. Same handling.
19. Backend unreachable (network down): fetch throws. Same handling.
20. Groq returns 200 but immediately closes without any data frames: fetch reads empty body, stream completes with empty buffer, no error pill. Assistant bubble stays empty. Acceptable but confusing. Mitigation: if we see 200-empty-body in testing, treat as interrupted.

## Errors after first token

21. Groq stream drops mid-response: fetch errors on next read. Partial content preserved in the message. `chatError: "interrupted"` set. Pill shows under that message.
22. Network disconnects mid-stream on the client side: same as 21.
23. Backend process restarts mid-stream: connection closes. Same as 21.

## Markdown and rendering

24. Model emits a link: rendered with `target="_blank"` and `rel="noopener noreferrer"`.
25. Model emits an image (`![]()`): rendered as nothing (dropped).
26. Model emits raw HTML (`<script>...</script>`): `skipHtml` prevents execution; rendered as literal text.
27. Model emits a code block with 1000 lines: rendered normally. No virtualization in v1.
28. Model emits a table: rendered via remark-gfm.
29. Model emits an incomplete code fence while streaming (```, no closing ```): renderer handles partial markdown gracefully (renders as code block that grows).
30. Model emits mid-word during streaming (half a sentence): intermediate state looks natural; cursor sits at the end.

## Chat history composition

31. First message ever in session is a suggestion click: `messages` list sent to backend contains only the new user message. Prior history is empty.
32. First message is a typed question: same. No transcript either if recording never started — prompt handles "(no transcript yet)".
33. Transcript is long (many chunks): full transcript is sent on every request. Token usage grows. Acceptable for v1 per the product decision; rolling summary is deferred.
34. Chat history is long (many messages): full history is sent on every request. Same reasoning.

## State and reset

35. Page reload: session store resets; all chat messages gone. Settings (prompts, API key) preserved via localStorage.
36. Navigate to /settings and back: session store preserved (root layout does not remount).
37. Stopping recording mid-stream: stream continues uninterrupted. The transcript snapshot used in the request is the one captured when the user's message was sent.

## Concurrency and UI

38. User tries to click Send while disabled: button is aria-disabled; click handler guards with `isStreamingChat` check and returns early.
39. User presses Enter while input is disabled: textarea has `disabled` attribute; keystroke is ignored by the browser.
40. User clicks a suggestion card while streaming: card click still appends a user message to the store, but the subscribe hook sees `isStreamingChat: true` and does not fire. The suggestion is effectively queued; the next successful stream-end will see it and fire then. **Desired behavior**: make the hook re-check after streaming ends. Implement with a post-stream nudge.

## New-message clear of prior error

41. `chatError: "interrupted"` is set from a prior failure. User sends a new message. The hook's start-of-fire sets `chatError: "none"` before appending the placeholder, so the pill disappears from the previous message. (The old partial content stays visible; only the pill is removed.)

## Settings migration

42. User had v1 settings with `detailedAnswerContextMode`. On first load post-v2, migrate drops the stale field, fills any empty prompts with the current defaults.
43. User had v0 settings (pre-v1). The v1 migrate already filled `suggestionPrompt`. v2 migrate now also fills `detailedAnswerPrompt` and `chatPrompt` if empty.
44. User has explicitly cleared a prompt to empty string in Settings: migrate does not clobber non-empty edits, but a cleared prompt looks empty, so migrate WILL refill it. Acceptable since an empty prompt is non-functional anyway.
