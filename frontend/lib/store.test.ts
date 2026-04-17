import { beforeEach, describe, expect, it } from "vitest";
import { useSessionStore } from "./store";

beforeEach(() => {
  useSessionStore.getState().reset();
});

describe("useSessionStore initial state", () => {
  it("starts with idle values across all fields", () => {
    const s = useSessionStore.getState();
    expect(s.isRecording).toBe(false);
    expect(s.recordingStartedAt).toBe(null);
    expect(s.transcript).toEqual([]);
    expect(s.suggestionBatches).toEqual([]);
    expect(s.chatMessages).toEqual([]);
    expect(s.micPermission).toBe("unknown");
    expect(s.recorderError).toBe("none");
  });
});

describe("recording transitions", () => {
  it("startRecording flips isRecording and sets recordingStartedAt", () => {
    useSessionStore.getState().startRecording();
    const s = useSessionStore.getState();
    expect(s.isRecording).toBe(true);
    expect(typeof s.recordingStartedAt).toBe("number");
  });

  it("stopRecording flips isRecording back to false", () => {
    useSessionStore.getState().startRecording();
    useSessionStore.getState().stopRecording();
    expect(useSessionStore.getState().isRecording).toBe(false);
  });

  it("restart after stop leaves recordingStartedAt set (does not clear)", () => {
    useSessionStore.getState().startRecording();
    const firstStart = useSessionStore.getState().recordingStartedAt;
    useSessionStore.getState().stopRecording();
    // recordingStartedAt is a marker, not a live flag, so stop does not null it.
    expect(useSessionStore.getState().recordingStartedAt).toBe(firstStart);
  });
});

describe("mic and recorder error setters", () => {
  it.each(["unknown", "granted", "denied"] as const)(
    "setMicPermission accepts %s",
    (status) => {
      useSessionStore.getState().setMicPermission(status);
      expect(useSessionStore.getState().micPermission).toBe(status);
    },
  );

  it.each(["none", "auto-stopped"] as const)(
    "setRecorderError accepts %s",
    (error) => {
      useSessionStore.getState().setRecorderError(error);
      expect(useSessionStore.getState().recorderError).toBe(error);
    },
  );
});

describe("transcript mutations", () => {
  it("addTranscriptChunk appends in order", () => {
    const s = useSessionStore.getState();
    s.addTranscriptChunk({ id: "a", text: "first", timestamp: 1 });
    s.addTranscriptChunk({ id: "b", text: "second", timestamp: 2 });
    expect(useSessionStore.getState().transcript.map((c) => c.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("multiple start/stop cycles keep appending to one transcript", () => {
    const s = useSessionStore.getState();
    s.startRecording();
    s.addTranscriptChunk({ id: "a", text: "pre-stop", timestamp: 1 });
    s.stopRecording();
    s.startRecording();
    s.addTranscriptChunk({ id: "b", text: "post-restart", timestamp: 2 });
    expect(useSessionStore.getState().transcript).toHaveLength(2);
  });
});

describe("reset", () => {
  it("clears recording, transcript, and both new recorder fields", () => {
    const s = useSessionStore.getState();
    s.startRecording();
    s.setMicPermission("granted");
    s.setRecorderError("auto-stopped");
    s.addTranscriptChunk({ id: "a", text: "x", timestamp: 1 });
    s.reset();
    const after = useSessionStore.getState();
    expect(after.isRecording).toBe(false);
    expect(after.transcript).toEqual([]);
    expect(after.micPermission).toBe("unknown");
    expect(after.recorderError).toBe("none");
  });
});
