# Out of scope

Explicitly not part of this feature.

## Deferred

1. **Streaming cancellation.** No Stop-and-actually-stop button. The Send button shows a stop icon while streaming for visual affordance only. An AbortController hookup is a small follow-up.
2. **Retry button on errored messages.** User has to resend manually.
3. **Persistence of chat history.** Reload resets.
4. **Rolling summary of long transcripts.** Full transcript is sent on every request in v1.
5. **Token-usage meter.** No visible indication of prompt cost or size.
6. **Per-message timestamps rendered in the UI.** Timestamps are stored (for export) but not shown.

## Permanent

7. **Message search or navigation.**
8. **Message edit or delete.**
9. **Attachments: images, files, voice notes.**
10. **Threading or reply references.**
11. **Copy-to-clipboard button on assistant messages.** Browser select-copy works fine.
12. **Typing indicators beyond the streaming cursor.**
13. **Rate-limit-specific feedback** ("You are being throttled"). Any failure is a single generic "Connection interrupted" pill.
14. **Multi-language prompts.** Prompts are English.
15. **System message for conversation summary** (separate feature).
16. **Voice output (TTS) of the assistant's response.**
17. **Code execution, tool use, function calling.** Groq's chat completions can do these; we do not wire them.
18. **Confidence scores per message.** Unreliable and cluttering.
19. **Image rendering in markdown.** Dropped for XSS safety.
20. **Raw HTML rendering in markdown.** Dropped for XSS safety.
21. **Collapsible code blocks.** Long code renders in full.
22. **Assistant avatars or user names.** Minimal labels only ("YOU" and "ASSISTANT").
23. **Message reactions** (thumbs, flags, bookmarks). No user feedback signal here.
24. **Cross-device sync, export to Notion, etc.**
25. **Backend-side chat logs or audit trail.** Backend is stateless.
