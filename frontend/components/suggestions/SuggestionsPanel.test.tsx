import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionStore } from "@/lib/store";
import { useSettingsStore } from "@/lib/settings-store";
import type { RecorderHandle } from "@/hooks/useRecorder";

// Stub the auto-refresh hook so the panel renders without firing real fetches.
vi.mock("@/hooks/useAutoRefresh", () => ({
  useAutoRefresh: () => ({ manualRefresh: vi.fn() }),
}));

import { SuggestionsPanel } from "./SuggestionsPanel";

function makeRecorder(getChunkStart: () => number | null): RecorderHandle {
  return {
    start: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    flushNow: vi.fn(async () => undefined),
    getChunkStart,
  };
}

function resetStores(): void {
  useSessionStore.setState({
    isRecording: false,
    recordingStartedAt: null,
    transcript: [],
    suggestionBatches: [],
    isLoadingSuggestions: false,
    lastRefreshAt: null,
    chatMessages: [],
    isStreamingChat: false,
    micPermission: "unknown",
    recorderError: "none",
    suggestionError: "none",
    chatError: "none",
  });
  useSettingsStore.setState({ refreshIntervalSeconds: 30 });
}

beforeEach(() => {
  resetStores();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("SuggestionsPanel countdown", () => {
  it("shows the chunk-anchored countdown when isRecording is true", () => {
    vi.useFakeTimers();
    const t0 = new Date("2026-04-17T10:00:00Z").getTime();
    vi.setSystemTime(t0);

    useSessionStore.setState({ isRecording: true });
    // Chunk started 5 seconds ago. Expected display: 30 - 5 = 25.
    const recorder = makeRecorder(() => t0 - 5000);

    render(<SuggestionsPanel recorder={recorder} />);

    expect(screen.getByText(/auto-refresh in 25s/i)).toBeInTheDocument();
  });

  it("falls back to the 'on next chunk' label when isRecording is false", () => {
    useSessionStore.setState({ isRecording: false });
    const recorder = makeRecorder(() => null);

    render(<SuggestionsPanel recorder={recorder} />);

    expect(
      screen.getByText(/auto-refresh on next chunk/i),
    ).toBeInTheDocument();
  });

  it("resets to a full window when chunkStart advances (e.g., manual flush)", () => {
    vi.useFakeTimers();
    const t0 = new Date("2026-04-17T10:00:00Z").getTime();
    vi.setSystemTime(t0);

    useSessionStore.setState({ isRecording: true });
    let chunkStart = t0 - 28000;
    const recorder = makeRecorder(() => chunkStart);

    render(<SuggestionsPanel recorder={recorder} />);
    expect(screen.getByText(/auto-refresh in 2s/i)).toBeInTheDocument();

    // Simulate flushNow / rotation: chunkStart jumps to "now".
    chunkStart = t0;
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText(/auto-refresh in 29s/i)).toBeInTheDocument();
  });
});
