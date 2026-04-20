import { act, renderHook } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { useSessionStore } from "@/lib/store";
import { useSettingsStore } from "@/lib/settings-store";

vi.mock("@/lib/api", () => ({
  transcribeAudio: vi.fn(),
}));

const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

import { transcribeAudio } from "@/lib/api";
import { useRecorder } from "./useRecorder";

// Minimal MediaRecorder stand-in for jsdom, which has no real implementation.
// stop() fires ondataavailable then onstop synchronously so the hook's
// closeRecorderForBlob promise resolves inside the test's act() block.
class MockMediaRecorder {
  static isTypeSupported = (): boolean => true;
  state: "recording" | "inactive" = "inactive";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  private mime: string;

  constructor(_stream: MediaStream, opts?: { mimeType: string }) {
    this.mime = opts?.mimeType ?? "audio/webm";
  }

  start(): void {
    this.state = "recording";
  }

  stop(): void {
    if (this.state === "inactive") return;
    this.state = "inactive";
    this.ondataavailable?.({
      data: new Blob(["audio"], { type: this.mime }),
    });
    this.onstop?.();
  }
}

const fakeStream = {
  getTracks: () => [{ stop: vi.fn() }],
} as unknown as MediaStream;

function resetStores(): void {
  useSessionStore.setState({
    isRecording: false,
    recordingStartedAt: null,
    transcript: [],
    micPermission: "unknown",
    recorderError: "none",
    suggestionBatches: [],
    isLoadingSuggestions: false,
    lastRefreshAt: null,
    chatMessages: [],
    isStreamingChat: false,
  });
  useSettingsStore.setState({ groqApiKey: "" });
}

beforeEach(() => {
  resetStores();
  vi.stubGlobal("MediaRecorder", MockMediaRecorder);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn(async () => fakeStream),
    },
  });
  vi.mocked(transcribeAudio).mockReset();
  toastErrorMock.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("useRecorder.start guards", () => {
  it("aborts with a toast when the Groq key is empty", async () => {
    const { result } = renderHook(() => useRecorder());
    await act(async () => {
      await result.current.start();
    });
    expect(useSessionStore.getState().isRecording).toBe(false);
    expect(toastErrorMock).toHaveBeenCalled();
    const msg = toastErrorMock.mock.calls[0][0] as string;
    expect(msg).toMatch(/Groq API key/i);
  });

  it("sets micPermission to 'denied' and toasts when getUserMedia rejects", async () => {
    useSettingsStore.setState({ groqApiKey: "sk" });
    const getUserMedia = navigator.mediaDevices
      .getUserMedia as unknown as ReturnType<typeof vi.fn>;
    getUserMedia.mockRejectedValueOnce(new Error("permission denied"));

    const { result } = renderHook(() => useRecorder());
    await act(async () => {
      await result.current.start();
    });
    expect(useSessionStore.getState().micPermission).toBe("denied");
    expect(useSessionStore.getState().isRecording).toBe(false);
    expect(toastErrorMock).toHaveBeenCalled();
    const msg = toastErrorMock.mock.calls[0][0] as string;
    expect(msg).toMatch(/Microphone access denied/i);
  });

  it("is idempotent: second start while already recording is a no-op", async () => {
    useSettingsStore.setState({ groqApiKey: "sk" });
    const getUserMedia = navigator.mediaDevices
      .getUserMedia as unknown as ReturnType<typeof vi.fn>;

    const { result } = renderHook(() => useRecorder());
    await act(async () => {
      await result.current.start();
    });
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    await act(async () => {
      await result.current.start();
    });
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });
});

describe("useRecorder.start success path", () => {
  it("grants permission, clears prior error, and flips isRecording", async () => {
    useSettingsStore.setState({ groqApiKey: "sk" });
    useSessionStore.getState().setRecorderError("auto-stopped");

    const { result } = renderHook(() => useRecorder());
    await act(async () => {
      await result.current.start();
    });

    const s = useSessionStore.getState();
    expect(s.isRecording).toBe(true);
    expect(s.micPermission).toBe("granted");
    expect(s.recorderError).toBe("none");
  });
});

describe("useRecorder.getChunkStart", () => {
  it("returns null before start is called", () => {
    const { result } = renderHook(() => useRecorder());
    expect(result.current.getChunkStart()).toBeNull();
  });

  it("returns a number after start succeeds", async () => {
    useSettingsStore.setState({ groqApiKey: "sk" });
    vi.useFakeTimers();
    const t0 = new Date("2026-04-17T10:00:00Z").getTime();
    vi.setSystemTime(t0);

    const { result } = renderHook(() => useRecorder());
    await act(async () => {
      await result.current.start();
    });

    expect(result.current.getChunkStart()).toBe(t0);
  });

  it("returns null after stop", async () => {
    useSettingsStore.setState({ groqApiKey: "sk" });
    const { result } = renderHook(() => useRecorder());
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await result.current.stop();
    });
    expect(result.current.getChunkStart()).toBeNull();
  });
});

describe("useRecorder.stop", () => {
  it("flips isRecording and skips the POST for a sub-2s final chunk", async () => {
    useSettingsStore.setState({ groqApiKey: "sk" });
    const { result } = renderHook(() => useRecorder());
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await result.current.stop();
    });
    expect(useSessionStore.getState().isRecording).toBe(false);
    expect(transcribeAudio).not.toHaveBeenCalled();
  });

  it("posts the final chunk and appends to transcript when duration >= 2s", async () => {
    useSettingsStore.setState({ groqApiKey: "sk" });
    vi.mocked(transcribeAudio).mockResolvedValue({
      text: "final thought",
      duration_ms: 3000,
    });

    vi.useFakeTimers();
    const t0 = new Date("2026-04-17T10:00:00Z").getTime();
    vi.setSystemTime(t0);

    const { result } = renderHook(() => useRecorder());
    await act(async () => {
      await result.current.start();
    });

    // Simulate 3 seconds of recording before the user stops.
    vi.setSystemTime(t0 + 3000);

    await act(async () => {
      await result.current.stop();
    });

    expect(transcribeAudio).toHaveBeenCalledTimes(1);
    const firstCall = vi.mocked(transcribeAudio).mock.calls[0][0];
    expect(firstCall.apiKey).toBe("sk");
    expect(firstCall.durationMs).toBe(3000);

    const transcript = useSessionStore.getState().transcript;
    expect(transcript).toHaveLength(1);
    expect(transcript[0].text).toBe("final thought");
  });

  it("does not append an empty transcript chunk when the filter erases the text", async () => {
    useSettingsStore.setState({ groqApiKey: "sk" });
    vi.mocked(transcribeAudio).mockResolvedValue({
      text: "",
      duration_ms: 3000,
    });

    vi.useFakeTimers();
    const t0 = new Date("2026-04-17T10:00:00Z").getTime();
    vi.setSystemTime(t0);

    const { result } = renderHook(() => useRecorder());
    await act(async () => {
      await result.current.start();
    });
    vi.setSystemTime(t0 + 3000);
    await act(async () => {
      await result.current.stop();
    });

    expect(transcribeAudio).toHaveBeenCalledTimes(1);
    expect(useSessionStore.getState().transcript).toHaveLength(0);
  });
});
