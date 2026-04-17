import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionStore } from "@/lib/store";
import { useSettingsStore } from "@/lib/settings-store";
import type { RecorderHandle } from "@/hooks/useRecorder";

vi.mock("@/lib/api", () => ({
  fetchSuggestions: vi.fn(),
}));

import { fetchSuggestions } from "@/lib/api";
import { useAutoRefresh } from "./useAutoRefresh";

function makeRecorder(): RecorderHandle {
  return {
    start: vi.fn(async () => {}),
    stop: vi.fn(async () => {}),
    flushNow: vi.fn(async () => {}),
  };
}

function resetStores(): void {
  useSessionStore.setState({
    isRecording: false,
    recordingStartedAt: null,
    transcript: [],
    micPermission: "unknown",
    recorderError: "none",
    suggestionError: "none",
    suggestionBatches: [],
    isLoadingSuggestions: false,
    lastRefreshAt: null,
    chatMessages: [],
    isStreamingChat: false,
  });
  useSettingsStore.setState({
    groqApiKey: "sk-test",
    suggestionPrompt: "SYSTEM PROMPT",
    suggestionContextChunkCount: 3,
  });
}

function validResponse() {
  return {
    batch_id: "b_test",
    timestamp: Date.now(),
    moment_type: "question_asked" as const,
    suggestions: [
      {
        id: "s_1",
        type: "answer" as const,
        preview: "p",
        reasoning: "r",
      },
    ],
  };
}

beforeEach(() => {
  resetStores();
  vi.mocked(fetchSuggestions).mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useAutoRefresh auto-refresh subscription", () => {
  it("does not fire when transcript is empty", async () => {
    const { result } = renderHook(() => useAutoRefresh(makeRecorder()));
    expect(result.current).toBeDefined();
    // Tick once for React effects.
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchSuggestions).not.toHaveBeenCalled();
  });

  it("fires a refresh when a new transcript chunk lands", async () => {
    vi.mocked(fetchSuggestions).mockResolvedValue(validResponse());
    renderHook(() => useAutoRefresh(makeRecorder()));
    await act(async () => {
      useSessionStore.getState().addTranscriptChunk({
        id: "c_1",
        text: "hello",
        timestamp: Date.now(),
      });
    });
    await waitFor(() => {
      expect(fetchSuggestions).toHaveBeenCalledTimes(1);
    });
    expect(useSessionStore.getState().suggestionBatches).toHaveLength(1);
  });

  it("fires again on a second chunk (one call per chunk)", async () => {
    vi.mocked(fetchSuggestions).mockResolvedValue(validResponse());
    renderHook(() => useAutoRefresh(makeRecorder()));
    await act(async () => {
      useSessionStore.getState().addTranscriptChunk({
        id: "c_1",
        text: "first",
        timestamp: 1,
      });
    });
    await waitFor(() => {
      expect(fetchSuggestions).toHaveBeenCalledTimes(1);
    });
    await act(async () => {
      useSessionStore.getState().addTranscriptChunk({
        id: "c_2",
        text: "second",
        timestamp: 2,
      });
    });
    await waitFor(() => {
      expect(fetchSuggestions).toHaveBeenCalledTimes(2);
    });
  });

  it("sends last N chunks where N = suggestionContextChunkCount", async () => {
    useSettingsStore.setState({ suggestionContextChunkCount: 2 });
    vi.mocked(fetchSuggestions).mockResolvedValue(validResponse());
    renderHook(() => useAutoRefresh(makeRecorder()));
    await act(async () => {
      const s = useSessionStore.getState();
      s.addTranscriptChunk({ id: "a", text: "alpha", timestamp: 1 });
      s.addTranscriptChunk({ id: "b", text: "bravo", timestamp: 2 });
      s.addTranscriptChunk({ id: "c", text: "charlie", timestamp: 3 });
    });
    await waitFor(() => {
      expect(fetchSuggestions).toHaveBeenCalled();
    });
    const call = vi.mocked(fetchSuggestions).mock.calls[0][0];
    expect(call.transcript).toHaveLength(2);
    expect(call.transcript.map((c) => c.id)).toEqual(["b", "c"]);
  });
});

describe("useAutoRefresh key handling", () => {
  it("sets suggestionError=key-invalid when Groq key is empty", async () => {
    useSettingsStore.setState({ groqApiKey: "" });
    renderHook(() => useAutoRefresh(makeRecorder()));
    await act(async () => {
      useSessionStore.getState().addTranscriptChunk({
        id: "c_1",
        text: "hello",
        timestamp: Date.now(),
      });
    });
    await waitFor(() => {
      expect(useSessionStore.getState().suggestionError).toBe("key-invalid");
    });
    expect(fetchSuggestions).not.toHaveBeenCalled();
  });

  it("flips to key-invalid on upstream 401", async () => {
    vi.mocked(fetchSuggestions).mockRejectedValue(
      new Error("suggestions failed: 401"),
    );
    renderHook(() => useAutoRefresh(makeRecorder()));
    await act(async () => {
      useSessionStore.getState().addTranscriptChunk({
        id: "c_1",
        text: "hello",
        timestamp: Date.now(),
      });
    });
    await waitFor(() => {
      expect(useSessionStore.getState().suggestionError).toBe("key-invalid");
    });
  });
});

describe("useAutoRefresh failure escalation", () => {
  it("does not surface error after one failure", async () => {
    vi.mocked(fetchSuggestions).mockRejectedValue(
      new Error("suggestions failed: 502"),
    );
    renderHook(() => useAutoRefresh(makeRecorder()));
    await act(async () => {
      useSessionStore.getState().addTranscriptChunk({
        id: "c_1",
        text: "hello",
        timestamp: 1,
      });
    });
    await waitFor(() => {
      expect(fetchSuggestions).toHaveBeenCalledTimes(1);
    });
    expect(useSessionStore.getState().suggestionError).toBe("none");
  });

  it("flips to failing after three consecutive failures", async () => {
    vi.mocked(fetchSuggestions).mockRejectedValue(
      new Error("suggestions failed: 502"),
    );
    renderHook(() => useAutoRefresh(makeRecorder()));
    for (let i = 0; i < 3; i += 1) {
      await act(async () => {
        useSessionStore.getState().addTranscriptChunk({
          id: `c_${i}`,
          text: "t",
          timestamp: i,
        });
      });
      await waitFor(() => {
        expect(fetchSuggestions).toHaveBeenCalledTimes(i + 1);
      });
    }
    expect(useSessionStore.getState().suggestionError).toBe("failing");
  });

  it("resets failure count after one success", async () => {
    const mock = vi.mocked(fetchSuggestions);
    mock
      .mockRejectedValueOnce(new Error("suggestions failed: 502"))
      .mockRejectedValueOnce(new Error("suggestions failed: 502"))
      .mockResolvedValueOnce(validResponse())
      .mockRejectedValueOnce(new Error("suggestions failed: 502"));

    renderHook(() => useAutoRefresh(makeRecorder()));
    for (let i = 0; i < 4; i += 1) {
      await act(async () => {
        useSessionStore.getState().addTranscriptChunk({
          id: `c_${i}`,
          text: "t",
          timestamp: i,
        });
      });
      await waitFor(() => {
        expect(fetchSuggestions).toHaveBeenCalledTimes(i + 1);
      });
    }
    // Last attempt is a single failure after a reset: should NOT be "failing".
    expect(useSessionStore.getState().suggestionError).toBe("none");
  });
});

describe("useAutoRefresh manualRefresh", () => {
  it("flushes recorder then fires a refresh", async () => {
    vi.mocked(fetchSuggestions).mockResolvedValue(validResponse());
    const recorder = makeRecorder();
    const { result } = renderHook(() => useAutoRefresh(recorder));
    useSessionStore.getState().addTranscriptChunk({
      id: "c_1",
      text: "hello",
      timestamp: 1,
    });
    // Let the chunk-driven auto-refresh settle first.
    await waitFor(() => {
      expect(fetchSuggestions).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await result.current.manualRefresh();
    });
    expect(recorder.flushNow).toHaveBeenCalled();
    expect(fetchSuggestions).toHaveBeenCalledTimes(2);
  });

  it("queues the manual click when already loading, and fires after", async () => {
    // First call hangs until we resolve it, so isLoadingSuggestions stays true.
    let resolveFirst: (value: ReturnType<typeof validResponse>) => void = () => {};
    const firstPromise = new Promise<ReturnType<typeof validResponse>>(
      (resolve) => {
        resolveFirst = resolve;
      },
    );
    vi.mocked(fetchSuggestions).mockImplementationOnce(() => firstPromise);
    vi.mocked(fetchSuggestions).mockResolvedValue(validResponse());

    const recorder = makeRecorder();
    const { result } = renderHook(() => useAutoRefresh(recorder));

    // Trigger the hanging auto-refresh.
    await act(async () => {
      useSessionStore.getState().addTranscriptChunk({
        id: "c_1",
        text: "hello",
        timestamp: 1,
      });
    });
    await waitFor(() => {
      expect(useSessionStore.getState().isLoadingSuggestions).toBe(true);
    });

    // Manual click while in flight: should queue, not fire.
    await act(async () => {
      await result.current.manualRefresh();
    });
    expect(fetchSuggestions).toHaveBeenCalledTimes(1);

    // Unblock the first call.
    await act(async () => {
      resolveFirst(validResponse());
    });

    // Pending manual should now have fired.
    await waitFor(() => {
      expect(fetchSuggestions).toHaveBeenCalledTimes(2);
    });
  });
});

describe("useAutoRefresh response mapping", () => {
  it("maps snake_case response fields to camelCase batch", async () => {
    vi.mocked(fetchSuggestions).mockResolvedValue({
      batch_id: "b_abc",
      timestamp: 42,
      moment_type: "claim_made",
      suggestions: [
        { id: "s_x", type: "fact_check", preview: "p", reasoning: "r" },
      ],
    });
    renderHook(() => useAutoRefresh(makeRecorder()));
    await act(async () => {
      useSessionStore.getState().addTranscriptChunk({
        id: "c_1",
        text: "t",
        timestamp: 0,
      });
    });
    await waitFor(() => {
      expect(useSessionStore.getState().suggestionBatches).toHaveLength(1);
    });
    const batch = useSessionStore.getState().suggestionBatches[0];
    expect(batch.id).toBe("b_abc");
    expect(batch.timestamp).toBe(42);
    expect(batch.momentType).toBe("claim_made");
  });
});
