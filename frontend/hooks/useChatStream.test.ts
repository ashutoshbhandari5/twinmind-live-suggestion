import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionStore } from "@/lib/store";
import { useSettingsStore } from "@/lib/settings-store";

vi.mock("@/lib/api", () => ({
  streamChat: vi.fn(),
}));

import { streamChat } from "@/lib/api";
import { useChatStream } from "./useChatStream";

function resetStores(): void {
  useSessionStore.setState({
    isRecording: false,
    recordingStartedAt: null,
    transcript: [],
    micPermission: "unknown",
    recorderError: "none",
    suggestionError: "none",
    chatError: "none",
    suggestionBatches: [],
    isLoadingSuggestions: false,
    lastRefreshAt: null,
    chatMessages: [],
    isStreamingChat: false,
  });
  useSettingsStore.setState({
    groqApiKey: "sk",
    detailedAnswerPrompt: "DETAILED",
    chatPrompt: "CHAT",
  });
}

beforeEach(() => {
  resetStores();
  vi.mocked(streamChat).mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useChatStream guards", () => {
  it("does not fire when chatMessages is empty", async () => {
    renderHook(() => useChatStream());
    await act(async () => {
      await Promise.resolve();
    });
    expect(streamChat).not.toHaveBeenCalled();
  });

  it("does not fire when last message is assistant", async () => {
    useSessionStore.setState({
      chatMessages: [
        { id: "u1", role: "user", content: "x", timestamp: 0 },
        { id: "a1", role: "assistant", content: "y", timestamp: 1 },
      ],
    });
    renderHook(() => useChatStream());
    await act(async () => {
      await Promise.resolve();
    });
    expect(streamChat).not.toHaveBeenCalled();
  });

  it("does not fire when isStreamingChat is true", async () => {
    useSessionStore.setState({
      chatMessages: [{ id: "u1", role: "user", content: "x", timestamp: 0 }],
      isStreamingChat: true,
    });
    renderHook(() => useChatStream());
    await act(async () => {
      await Promise.resolve();
    });
    expect(streamChat).not.toHaveBeenCalled();
  });
});

describe("useChatStream happy path", () => {
  it("appends placeholder assistant and streams tokens into it", async () => {
    vi.mocked(streamChat).mockImplementation(async (args) => {
      args.onToken("Hello");
      args.onToken(" world");
    });
    renderHook(() => useChatStream());
    await act(async () => {
      useSessionStore.getState().addChatMessage({
        id: "u1",
        role: "user",
        content: "What's up",
        timestamp: 0,
      });
    });
    await waitFor(() => {
      expect(streamChat).toHaveBeenCalled();
    });
    await waitFor(() => {
      const msgs = useSessionStore.getState().chatMessages;
      expect(msgs).toHaveLength(2);
      expect(msgs[1].role).toBe("assistant");
      expect(msgs[1].content).toBe("Hello world");
    });
    expect(useSessionStore.getState().isStreamingChat).toBe(false);
    expect(useSessionStore.getState().chatError).toBe("none");
  });

  it("uses detailed-answer prompt when sourceSuggestion present", async () => {
    vi.mocked(streamChat).mockResolvedValue(undefined);
    renderHook(() => useChatStream());
    await act(async () => {
      useSessionStore.getState().addChatMessage({
        id: "u1",
        role: "user",
        content: "click me",
        timestamp: 0,
        sourceSuggestion: {
          type: "answer",
          preview: "click me",
          reasoning: "rsn",
        },
      });
    });
    await waitFor(() => {
      expect(streamChat).toHaveBeenCalled();
    });
    const call = vi.mocked(streamChat).mock.calls[0][0];
    expect(call.promptTemplate).toBe("DETAILED");
    expect(call.sourceSuggestion).toEqual({
      type: "answer",
      preview: "click me",
      reasoning: "rsn",
    });
  });

  it("uses chat prompt and null sourceSuggestion for typed messages", async () => {
    vi.mocked(streamChat).mockResolvedValue(undefined);
    renderHook(() => useChatStream());
    await act(async () => {
      useSessionStore.getState().addChatMessage({
        id: "u1",
        role: "user",
        content: "typed",
        timestamp: 0,
      });
    });
    await waitFor(() => {
      expect(streamChat).toHaveBeenCalled();
    });
    const call = vi.mocked(streamChat).mock.calls[0][0];
    expect(call.promptTemplate).toBe("CHAT");
    expect(call.sourceSuggestion).toBeNull();
  });

  it("excludes the placeholder assistant from the messages payload", async () => {
    vi.mocked(streamChat).mockResolvedValue(undefined);
    renderHook(() => useChatStream());
    await act(async () => {
      useSessionStore.getState().addChatMessage({
        id: "u1",
        role: "user",
        content: "ask",
        timestamp: 0,
      });
    });
    await waitFor(() => {
      expect(streamChat).toHaveBeenCalled();
    });
    const call = vi.mocked(streamChat).mock.calls[0][0];
    // Only the user message; the assistant placeholder is filtered out.
    expect(call.messages).toHaveLength(1);
    expect(call.messages[0].role).toBe("user");
  });
});

describe("useChatStream error handling", () => {
  it("missing API key sets interrupted without calling streamChat", async () => {
    useSettingsStore.setState({ groqApiKey: "" });
    renderHook(() => useChatStream());
    await act(async () => {
      useSessionStore.getState().addChatMessage({
        id: "u1",
        role: "user",
        content: "ask",
        timestamp: 0,
      });
    });
    await waitFor(() => {
      expect(useSessionStore.getState().chatError).toBe("interrupted");
    });
    const msgs = useSessionStore.getState().chatMessages;
    expect(msgs).toHaveLength(2);
    expect(msgs[1].role).toBe("assistant");
    expect(msgs[1].content).toBe("");
    expect(streamChat).not.toHaveBeenCalled();
  });

  it("empty prompt template sets interrupted without calling streamChat", async () => {
    useSettingsStore.setState({ chatPrompt: "" });
    renderHook(() => useChatStream());
    await act(async () => {
      useSessionStore.getState().addChatMessage({
        id: "u1",
        role: "user",
        content: "ask",
        timestamp: 0,
      });
    });
    await waitFor(() => {
      expect(useSessionStore.getState().chatError).toBe("interrupted");
    });
    expect(streamChat).not.toHaveBeenCalled();
  });

  it("streamChat throwing preserves partial content and sets interrupted", async () => {
    vi.mocked(streamChat).mockImplementation(async (args) => {
      args.onToken("partial ");
      throw new Error("network down");
    });
    renderHook(() => useChatStream());
    await act(async () => {
      useSessionStore.getState().addChatMessage({
        id: "u1",
        role: "user",
        content: "ask",
        timestamp: 0,
      });
    });
    await waitFor(() => {
      expect(useSessionStore.getState().chatError).toBe("interrupted");
    });
    const msgs = useSessionStore.getState().chatMessages;
    expect(msgs[1].content).toBe("partial ");
    expect(useSessionStore.getState().isStreamingChat).toBe(false);
  });
});

describe("useChatStream double-fire safety", () => {
  it("never fires twice for the same user message id (Strict Mode safe)", async () => {
    vi.mocked(streamChat).mockResolvedValue(undefined);
    const { rerender } = renderHook(() => useChatStream());
    await act(async () => {
      useSessionStore.getState().addChatMessage({
        id: "u1",
        role: "user",
        content: "ask",
        timestamp: 0,
      });
    });
    await waitFor(() => {
      expect(streamChat).toHaveBeenCalledTimes(1);
    });
    rerender();
    await act(async () => {
      await Promise.resolve();
    });
    expect(streamChat).toHaveBeenCalledTimes(1);
  });
});

describe("useChatStream chatError reset on new user message", () => {
  it("clears prior interrupted state when a new fire begins", async () => {
    useSessionStore.getState().setChatError("interrupted");
    vi.mocked(streamChat).mockResolvedValue(undefined);
    renderHook(() => useChatStream());
    await act(async () => {
      useSessionStore.getState().addChatMessage({
        id: "u1",
        role: "user",
        content: "ask",
        timestamp: 0,
      });
    });
    await waitFor(() => {
      expect(streamChat).toHaveBeenCalled();
    });
    expect(useSessionStore.getState().chatError).toBe("none");
  });
});
