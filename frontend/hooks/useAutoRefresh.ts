"use client";

import { useEffect, useRef } from "react";
import { fetchSuggestions } from "@/lib/api";
import { useSessionStore } from "@/lib/store";
import { useSettingsStore } from "@/lib/settings-store";
import type { RecorderHandle } from "./useRecorder";

const MAX_CONSECUTIVE_FAILURES = 3;

type AutoRefreshHandle = {
  manualRefresh: () => Promise<void>;
};

export function useAutoRefresh(recorder: RecorderHandle): AutoRefreshHandle {
  const failureCountRef = useRef<number>(0);
  const pendingManualRef = useRef<boolean>(false);
  const suppressNextAutoRef = useRef<boolean>(false);
  const lastSeenLengthRef = useRef<number>(0);

  async function doRefresh(): Promise<void> {
    const session = useSessionStore.getState();
    if (session.isLoadingSuggestions) return;

    const settings = useSettingsStore.getState();
    const apiKey = settings.groqApiKey;
    if (!apiKey) {
      session.setSuggestionError("key-invalid");
      return;
    }

    const transcript = session.transcript;
    if (transcript.length === 0) return;

    session.setLoadingSuggestions(true);
    try {
      const prev = session.suggestionBatches[0];
      const lastN = transcript.slice(-settings.suggestionContextChunkCount);
      const sessionDurationMs = session.recordingStartedAt
        ? Date.now() - session.recordingStartedAt
        : 0;
      const previousSuggestions = prev
        ? prev.suggestions.map((s) => ({ type: s.type, preview: s.preview }))
        : [];

      const res = await fetchSuggestions({
        apiKey,
        transcript: lastN,
        promptTemplate: settings.suggestionPrompt,
        contextChunkCount: settings.suggestionContextChunkCount,
        sessionDurationMs,
        previousSuggestions,
      });

      session.addSuggestionBatch({
        id: res.batch_id,
        timestamp: res.timestamp,
        momentType: res.moment_type,
        suggestions: res.suggestions,
      });
      session.setSuggestionError("none");
      failureCountRef.current = 0;
    } catch (err) {
      failureCountRef.current += 1;
      // Status codes are plumbed through the thrown Error message from
      // lib/api.ts. Brittle but cheap; promote to a typed error if issues.
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("401")) {
        useSessionStore.getState().setSuggestionError("key-invalid");
      } else if (failureCountRef.current >= MAX_CONSECUTIVE_FAILURES) {
        useSessionStore.getState().setSuggestionError("failing");
      }
    } finally {
      useSessionStore.getState().setLoadingSuggestions(false);
      if (pendingManualRef.current) {
        pendingManualRef.current = false;
        void manualRefresh();
      }
    }
  }

  async function manualRefresh(): Promise<void> {
    const session = useSessionStore.getState();
    if (session.isLoadingSuggestions) {
      pendingManualRef.current = true;
      return;
    }
    // flushNow triggers a transcript chunk landing. Suppress the auto-refresh
    // effect that would otherwise fire for that landing; we fire our own call
    // below so the refresh uses the freshest transcript.
    suppressNextAutoRef.current = true;
    await recorder.flushNow();
    await doRefresh();
  }

  const transcriptLength = useSessionStore((s) => s.transcript.length);

  useEffect(() => {
    if (transcriptLength === 0) return;
    if (transcriptLength === lastSeenLengthRef.current) return;
    lastSeenLengthRef.current = transcriptLength;
    if (suppressNextAutoRef.current) {
      suppressNextAutoRef.current = false;
      return;
    }
    void doRefresh();
    // doRefresh reads stores via getState; deps are intentionally only length.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcriptLength]);

  return { manualRefresh };
}
