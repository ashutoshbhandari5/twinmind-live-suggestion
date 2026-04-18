# Out of scope

These are intentionally not part of this feature.

## Format

1. **Plain-text or Markdown export.** JSON only.
2. **CSV export.**
3. **YAML export.**
4. **Compressed export** (zip, gzip).
5. **Multi-file export** (separate files per column).

## Scope of data

6. **Partial export** (transcript-only, chat-only, batches-only).
7. **Date-range filter** ("last 5 minutes only").
8. **Redaction** of any sensitive content. The Groq API key is not in the session store and so cannot be exported anyway. Prompts are in Settings, not in the session, so they are also not exported.
9. **Per-batch or per-message export** (single item to clipboard).

## Distribution

10. **Clipboard copy** of the JSON.
11. **Share-by-URL** (no backend persistence; this would require a server).
12. **Email attachment** trigger.
13. **Upload to Drive / Notion / Slack.**

## Persistence and lifecycle

14. **Server-side persistence** of exports.
15. **Auto-export** on tab close, mic stop, or any other event.
16. **Scheduled export** (every N minutes).
17. **Re-import** of a saved session into the app.
18. **Diff between two exports.**

## UX

19. **Pre-download preview dialog.** One click → file downloads.
20. **Format chooser dialog.** JSON only.
21. **Filename customization** by user.
22. **Confirmation prompt** when re-exporting.

## Implementation

23. **Calling the backend `/export` endpoint.** Client-side blob download only. The backend endpoint remains in the code for now and is not removed in this feature.
24. **Streaming export to disk** (for very large sessions). `JSON.stringify` is synchronous; acceptable for take-home demo sessions.
25. **Web Worker offload** of the JSON serialization. Same reason.
