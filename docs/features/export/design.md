# Design

## Component changes

```
ExportButton (top bar)
  click handler → downloadExport()
```

That is the entire UI surface. No new components.

## Data flow

```
User clicks Export
  → downloadExport()
      → file = buildExportFile()
      → json = JSON.stringify(file, null, 2)
      → blob = new Blob([json], { type: "application/json" })
      → url = URL.createObjectURL(blob)
      → anchor.href = url; anchor.download = buildExportFilename(new Date())
      → anchor.click()
      → setTimeout(() => URL.revokeObjectURL(url), 1000)
```

No state changes. No store mutations. No async.

## Pure helpers

`frontend/lib/export.ts`:

```ts
export const APP_VERSION = "0.1.0";

export type ExportTranscriptChunk = {
  id: string;
  text: string;
  timestamp: number;
  timestampReadable: string;
};

export type ExportSuggestionBatch = {
  id: string;
  timestamp: number;
  timestampReadable: string;
  momentType: MomentType;
  suggestions: Array<{
    id: string;
    type: SuggestionType;
    preview: string;
    reasoning: string;
  }>;
};

export type ExportChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  timestampReadable: string;
  sourceSuggestion?: { type: SuggestionType; preview: string; reasoning?: string };
};

export type ExportFile = {
  exportedAt: number;
  exportedAtReadable: string;
  appVersion: string;
  sessionStartedAt: number | null;
  sessionStartedAtReadable: string | null;
  sessionDurationMs: number;
  note?: string;
  transcript: ExportTranscriptChunk[];
  suggestionBatches: ExportSuggestionBatch[];
  chatMessages: ExportChatMessage[];
};

export function buildExportFile(now: Date = new Date()): ExportFile { ... }
export function buildExportFilename(now: Date = new Date()): string { ... }
export function downloadExport(now: Date = new Date()): void { ... }
```

`now` is parameterized so tests can pin a fixed clock without monkey-patching `Date`.

## Timestamp formatting

`timestampReadable` is `Intl.DateTimeFormat("en-US", {...})` with `hour: "2-digit", minute: "2-digit", second: "2-digit", year: "numeric", month: "2-digit", day: "2-digit", hour12: true})`.

Output example: `04/17/2026, 10:30:15 PM`.

`null` timestamps (e.g., `sessionStartedAt` when recording never started) produce `null` for both raw and readable fields.

## Filename format

`buildExportFilename(now)` returns:

```
twinmind-session-{YYYY}-{MM}-{DD}-{HH}{MM}.json
```

All components are local time, zero-padded. Example: `twinmind-session-2026-04-17-2230.json` for 10:30 PM local time on April 17, 2026.

Implementation: `now.getFullYear()`, `now.getMonth() + 1`, `now.getDate()`, `now.getHours()`, `now.getMinutes()`, each `.toString().padStart(2, "0")` (year is naturally 4 digits).

## App version

Hardcoded in `lib/export.ts` as `APP_VERSION = "0.1.0"` (matches `frontend/package.json` `version` field). Bumped manually on release. Next.js does not expose package.json easily at runtime without a webpack plugin, and adding one for a single string is over-engineering.

## Empty-session note

If `transcript.length === 0 && suggestionBatches.length === 0 && chatMessages.length === 0`, the builder adds `note: "No session data recorded"` to the file. Otherwise the field is omitted (not `null`, not empty string).

## sessionStartedAt and sessionDurationMs

- `sessionStartedAt` is read directly from the session store.
- `sessionDurationMs`:
  - If `sessionStartedAt === null`: `0`.
  - Else: `now.getTime() - sessionStartedAt` (snapshot at export time, not "duration of all recordings").

This matches user intuition: "how long has my session been live?" rather than "how much audio did I record?"

## Why no backend round-trip

The browser holds every byte of the session in Zustand. POSTing it to `/export` so the server can echo it back adds a network hop, a failure mode, and a server-side log surface for content the user already owns. Client-side download is the right call.

The backend `/export` endpoint stays in the codebase to avoid the doc/test churn of removing it. Marked as deprecated in `out-of-scope.md`.

## Files that change

Frontend:
- `lib/export.ts`: new file with the pure helpers and the `downloadExport()` action.
- `components/shared/ExportButton.tsx`: drop `disabled`, wire `onClick` to `downloadExport`.

Backend:
- No changes.

## Latency

User clicks → file appears in Downloads in well under 100ms even with thousands of items. JSON.stringify and blob creation are synchronous and fast.

## Risks and unknowns

1. **Browser blob download support.** Universal in modern browsers. Safari, Chrome, Firefox all support `URL.createObjectURL` + anchor `download`.
2. **Download blocked by browser settings.** Possible but rare. We do not handle it; user sees the browser's own UI.
3. **Very large sessions.** `JSON.stringify` synchronous on the main thread. A 50-MB session would block the UI briefly. Acceptable; worst-case demo session is far below this.
4. **Locale-dependent `Intl.DateTimeFormat` output.** Hardcoded to `en-US` for consistent output across reviewers' machines.
