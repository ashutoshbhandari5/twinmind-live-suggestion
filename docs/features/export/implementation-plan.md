# Implementation plan

Status: Phase 4. Awaiting plan review gate.

## Ordering principle

Pure helpers first (testable in isolation, no DOM). Then the side-effecting download function. Then the button wire-up. Two files total.

## Sequence

### Step 1. lib/export.ts — types, builder, filename, downloader

File: `frontend/lib/export.ts` (new).

Contents:

```ts
import type { MomentType, SuggestionType } from "./types";
import { useSessionStore } from "./store";

export const APP_VERSION = "0.1.0";

const DT_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "2-digit",
  day: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

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
  sourceSuggestion?: {
    type: SuggestionType;
    preview: string;
    reasoning?: string;
  };
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

function readable(ts: number): string {
  return DT_FORMAT.format(new Date(ts));
}

export function buildExportFile(now: Date = new Date()): ExportFile {
  const session = useSessionStore.getState();
  const exportedAt = now.getTime();
  const sessionStartedAt = session.recordingStartedAt;

  const transcript: ExportTranscriptChunk[] = session.transcript.map((c) => ({
    id: c.id,
    text: c.text,
    timestamp: c.timestamp,
    timestampReadable: readable(c.timestamp),
  }));

  const suggestionBatches: ExportSuggestionBatch[] = session.suggestionBatches.map(
    (b) => ({
      id: b.id,
      timestamp: b.timestamp,
      timestampReadable: readable(b.timestamp),
      momentType: b.momentType,
      suggestions: b.suggestions.map((s) => ({
        id: s.id,
        type: s.type,
        preview: s.preview,
        reasoning: s.reasoning,
      })),
    }),
  );

  const chatMessages: ExportChatMessage[] = session.chatMessages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: m.timestamp,
    timestampReadable: readable(m.timestamp),
    ...(m.sourceSuggestion ? { sourceSuggestion: m.sourceSuggestion } : {}),
  }));

  const file: ExportFile = {
    exportedAt,
    exportedAtReadable: readable(exportedAt),
    appVersion: APP_VERSION,
    sessionStartedAt,
    sessionStartedAtReadable:
      sessionStartedAt === null ? null : readable(sessionStartedAt),
    sessionDurationMs:
      sessionStartedAt === null ? 0 : exportedAt - sessionStartedAt,
    transcript,
    suggestionBatches,
    chatMessages,
  };

  if (
    transcript.length === 0 &&
    suggestionBatches.length === 0 &&
    chatMessages.length === 0
  ) {
    file.note = "No session data recorded";
  }

  return file;
}

export function buildExportFilename(now: Date = new Date()): string {
  const yyyy = now.getFullYear().toString();
  const mm = (now.getMonth() + 1).toString().padStart(2, "0");
  const dd = now.getDate().toString().padStart(2, "0");
  const hh = now.getHours().toString().padStart(2, "0");
  const min = now.getMinutes().toString().padStart(2, "0");
  return `twinmind-session-${yyyy}-${mm}-${dd}-${hh}${min}.json`;
}

export function downloadExport(now: Date = new Date()): void {
  const file = buildExportFile(now);
  const json = JSON.stringify(file, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const filename = buildExportFilename(now);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // Release the blob URL after the browser has had a moment to start the
  // download. 1s is well over the time the click handler needs.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
```

Complexity: low-medium.
Depends on: existing types and store. No new deps.

### Step 2. Wire the Export button

File: `frontend/components/shared/ExportButton.tsx`.

Replace:

```tsx
"use client";

import { Button } from "@/components/ui/button";

export function ExportButton() {
  return (
    <Button variant="outline" size="sm" disabled>
      Export
    </Button>
  );
}
```

With:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { downloadExport } from "@/lib/export";

export function ExportButton() {
  return (
    <Button variant="outline" size="sm" onClick={() => downloadExport()}>
      Export
    </Button>
  );
}
```

Drop `disabled`. Wire `onClick`. Nothing else.

Complexity: trivial.
Depends on: step 1.

## Dependency graph

```
1 lib/export.ts ── 2 ExportButton wire
```

That is the whole graph.

## Commands per layer

After step 1:
```
cd frontend && npm run typecheck && npm run lint
```

After step 2:
```
cd frontend && npm run typecheck && npm run lint && npm run test
# then npm run dev and smoke-test by clicking Export.
```

## Manual verification checklist (before Phase 6)

- [ ] Click Export on a fresh session (no recording). File downloads named `twinmind-session-YYYY-MM-DD-HHMM.json`. Open it in a text editor: valid JSON, all three arrays empty, `note: "No session data recorded"` present.
- [ ] Click Export after recording for a minute. File contains transcript chunks with both `timestamp` and `timestampReadable` fields.
- [ ] Click Export after at least one suggestion batch landed. File contains the batch with `momentType` and three suggestions.
- [ ] Click Export after at least one chat exchange. File contains user and assistant messages, with `sourceSuggestion` present on suggestion-click messages.
- [ ] Filename matches local time (open the file's "Created" timestamp; should match the filename's HHMM).
- [ ] Filename has 2-digit day, month, hour, minute (zero-padded).

## Risks and unknowns

1. **jsdom in tests does not implement `URL.createObjectURL` or anchor `click()` for downloads.** Phase 6 tests will mock these or test only the pure helpers (`buildExportFile`, `buildExportFilename`). The full `downloadExport` flow is exercised in manual verification.
2. **Locale-dependent date formatting.** Hardcoded `"en-US"` in the formatter. Reviewers on other locales still see US-formatted timestamps. Acceptable.
3. **Browser pop-up blocker.** If the browser blocks the download, the user sees the browser's own UI. We do not handle it.
4. **Very large JSON.** Synchronous serialization on the main thread. Acceptable for take-home demos.
5. **APP_VERSION drift.** Constant in code may diverge from `frontend/package.json`. Acceptable; bump manually at release.
6. **Reading `useSessionStore.getState()` outside React.** Standard Zustand pattern; safe.

## What Phase 5 will produce

- One new file (`frontend/lib/export.ts`).
- One small change (`frontend/components/shared/ExportButton.tsx`).
- A working Export button. One click → JSON download.
- All existing tests (82 backend, 119 frontend) continue to pass.

## What Phase 5 will NOT produce

- Tests for the new code (Phase 6).
- Removal of the unused backend `/export` endpoint (deliberate, see README).
- Markdown / CSV / clipboard alternatives (out of scope).
