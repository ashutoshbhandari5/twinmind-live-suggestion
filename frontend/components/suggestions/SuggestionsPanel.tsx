"use client";

import { useEffect, useRef, useState } from "react";
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
  const isRecording = useSessionStore((s) => s.isRecording);
  const refreshIntervalSeconds = useSettingsStore(
    (s) => s.refreshIntervalSeconds,
  );

  const { manualRefresh } = useAutoRefresh(recorder);

  const countdown = useCountdown(
    recorder.getChunkStart,
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
  getChunkStart: () => number | null,
  intervalSeconds: number,
  isRecording: boolean,
): number | null {
  // Anchor to the recorder's current chunk start so pause/resume, manual
  // flush, and rotation all reset the countdown to a full window. Hold value
  // in state to keep render pure (no Date.now during render).
  const [countdown, setCountdown] = useState<number | null>(null);

  // Keep the latest getter accessible from inside the interval without
  // re-running the effect on every render of the parent.
  const getterRef = useRef(getChunkStart);
  useEffect(() => {
    getterRef.current = getChunkStart;
  });

  useEffect(() => {
    // When not recording, the hook returns null directly below; no interval
    // needed. Stored countdown value is ignored until recording resumes, at
    // which point the immediate tick() overwrites it.
    if (!isRecording) return;
    const tick = (): void => {
      const start = getterRef.current();
      if (start === null) {
        setCountdown(intervalSeconds);
        return;
      }
      const elapsed = (Date.now() - start) / 1000;
      setCountdown(
        Math.max(0, Math.min(intervalSeconds, Math.round(intervalSeconds - elapsed))),
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [intervalSeconds, isRecording]);

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
