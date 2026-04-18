import type { MomentType, SuggestionType } from "./types";
import { useSessionStore } from "./store";

// Bumped manually at release. Next does not expose package.json easily at
// runtime; a webpack DefinePlugin for one string is over-engineering here.
export const APP_VERSION = "0.1.0";

// Locale forced to en-US so reviewers see consistent timestamps regardless
// of their machine's locale.
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
  // Atomic snapshot. Reading once avoids torn reads if a chunk lands
  // between sub-reads.
  const session = useSessionStore.getState();
  const exportedAt = now.getTime();
  const sessionStartedAt = session.recordingStartedAt;

  const transcript: ExportTranscriptChunk[] = session.transcript.map((c) => ({
    id: c.id,
    text: c.text,
    timestamp: c.timestamp,
    timestampReadable: readable(c.timestamp),
  }));

  const suggestionBatches: ExportSuggestionBatch[] =
    session.suggestionBatches.map((b) => ({
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
    }));

  const chatMessages: ExportChatMessage[] = session.chatMessages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: m.timestamp,
    timestampReadable: readable(m.timestamp),
    // Spread-conditional so the field is omitted entirely when not set,
    // rather than serialized as null. Keeps the file clean.
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

  // Safari and Firefox sometimes ignore the download attribute on a
  // detached anchor. Mount briefly, click, then remove.
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // Release the blob URL after the browser has had time to start the
  // download. 1s is well over what the click handler needs.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
