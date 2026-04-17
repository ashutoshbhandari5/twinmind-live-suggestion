"use client";

import { useEffect, useState } from "react";
import { ColumnHeader } from "@/components/layout/ColumnHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import type { RecorderHandle } from "@/hooks/useRecorder";
import { useSessionStore } from "@/lib/store";
import { useSettingsStore } from "@/lib/settings-store";
import { ReloadButton } from "./ReloadButton";
import { SuggestionBatch } from "./SuggestionBatch";

type Props = { recorder: RecorderHandle };

export function SuggestionsPanel({ recorder }: Props) {
  const batches = useSessionStore((s) => s.suggestionBatches);
  const isLoading = useSessionStore((s) => s.isLoadingSuggestions);
  const suggestionError = useSessionStore((s) => s.suggestionError);
  const transcriptLength = useSessionStore((s) => s.transcript.length);
  const recordingStartedAt = useSessionStore((s) => s.recordingStartedAt);
  const isRecording = useSessionStore((s) => s.isRecording);
  const refreshIntervalSeconds = useSettingsStore(
    (s) => s.refreshIntervalSeconds,
  );

  const { manualRefresh } = useAutoRefresh(recorder);

  const lastBatchTimestamp = batches[0]?.timestamp ?? null;
  const countdown = useCountdown(
    lastBatchTimestamp,
    recordingStartedAt,
    refreshIntervalSeconds,
    isRecording,
  );

  const showEmptyHint =
    batches.length === 0 && !isLoading && transcriptLength === 0;

  return (
    <div className="flex h-full flex-col">
      <ColumnHeader
        index={2}
        title="Live Suggestions"
        right={`${batches.length} BATCHES`}
      />
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <ReloadButton onRefresh={manualRefresh} disabled={isLoading} />
        <span className="text-[10px] tracking-widest text-muted-foreground">
          {countdown === null
            ? "auto-refresh on next chunk"
            : `auto-refresh in ${countdown}s`}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 min-h-0">
        {suggestionError !== "none" && <ErrorCard kind={suggestionError} />}
        {isLoading && <SkeletonBatch />}
        {showEmptyHint && (
          <Card>
            <CardContent className="p-3 text-xs text-muted-foreground">
              Suggestions appear here once recording starts.
            </CardContent>
          </Card>
        )}
        {batches.map((b, i) => (
          <SuggestionBatch
            key={b.id}
            batch={b}
            index={batches.length - i}
            highlighted={i === 0}
          />
        ))}
      </div>
    </div>
  );
}

function useCountdown(
  lastBatchTimestamp: number | null,
  recordingStartedAt: number | null,
  intervalSeconds: number,
  isRecording: boolean,
): number | null {
  // Hold countdown in state so render stays pure (no Date.now during render).
  // All setCountdown calls live inside a setInterval callback so the effect
  // body does no synchronous state updates.
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!isRecording) return;
    const base = lastBatchTimestamp ?? recordingStartedAt;
    const id = setInterval(() => {
      if (base === null) {
        setCountdown(intervalSeconds);
        return;
      }
      const elapsed = (Date.now() - base) / 1000;
      setCountdown(Math.max(0, Math.round(intervalSeconds - elapsed)));
    }, 1000);
    return () => clearInterval(id);
  }, [lastBatchTimestamp, recordingStartedAt, intervalSeconds, isRecording]);

  if (!isRecording) return null;
  return countdown;
}

function SkeletonBatch() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 text-[10px] tracking-widest text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        <span>— GENERATING —</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}

function ErrorCard({ kind }: { kind: "failing" | "key-invalid" }) {
  const copy =
    kind === "key-invalid"
      ? "Groq rejected your API key. Open Settings and paste a valid key."
      : "Suggestions are failing. Check your connection or API key.";
  return (
    <Card className="border-destructive/50 bg-destructive/10">
      <CardContent className="p-3 text-xs text-destructive">
        {copy}
      </CardContent>
    </Card>
  );
}
