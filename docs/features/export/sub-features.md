# Sub-features

## 1. export-button

The existing `ExportButton` component in the top bar. Currently disabled. We:
- Remove the disabled state (always enabled per the design decision).
- Wire `onClick` to call the download function.
- Keep the shadcn `Button` (variant="outline", size="sm") and the visible text "Export".

Lives in `frontend/components/shared/ExportButton.tsx`.

## 2. payload-builder

A pure function `buildExportFile(): ExportFile` that reads from `useSessionStore.getState()` and returns the rich file shape. Adds:
- Envelope: `exportedAt`, `exportedAtReadable`, `appVersion`, `sessionStartedAt`, `sessionStartedAtReadable`, `sessionDurationMs`.
- Per-item `timestampReadable` strings for every transcript chunk, suggestion batch, and chat message.
- Optional top-level `note: "No session data recorded"` when all three arrays are empty.

Pure function, no side effects. Easy to unit test.

Lives in `frontend/lib/export.ts`.

## 3. filename-formatter

A helper `buildExportFilename(now: Date): string` that returns `twinmind-session-YYYY-MM-DD-HHMM.json` using local time. Always 4-digit year, 2-digit month/day/hour/minute, padded.

Pure function. Lives in `frontend/lib/export.ts`.

## 4. client-side-download

A function `downloadExport(): void` that:
- Calls `buildExportFile()`.
- Serializes with `JSON.stringify(file, null, 2)` (pretty-printed, 2-space indent).
- Wraps in a `Blob` with `type: "application/json"`.
- Creates a temporary object URL via `URL.createObjectURL(blob)`.
- Programmatically clicks an anchor with `download={filename}` and `href={url}`.
- Revokes the object URL after a short timeout to release memory.

Lives in `frontend/lib/export.ts`. Called from `ExportButton.handleClick`.
