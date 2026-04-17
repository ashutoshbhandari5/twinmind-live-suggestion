import { afterEach, describe, expect, it, vi } from "vitest";
import { MIN_CHUNK_DURATION_MS, pickRecorderMimeType } from "./audio";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MIN_CHUNK_DURATION_MS", () => {
  it("matches the backend constant (2000ms)", () => {
    expect(MIN_CHUNK_DURATION_MS).toBe(2000);
  });
});

describe("pickRecorderMimeType", () => {
  function stubSupport(supported: string[]): void {
    vi.stubGlobal("MediaRecorder", {
      isTypeSupported: (m: string) => supported.includes(m),
    });
  }

  it("prefers audio/webm;codecs=opus when available", () => {
    stubSupport([
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
    ]);
    expect(pickRecorderMimeType()).toBe("audio/webm;codecs=opus");
  });

  it("falls back to audio/webm when opus is unavailable", () => {
    stubSupport(["audio/webm", "audio/mp4"]);
    expect(pickRecorderMimeType()).toBe("audio/webm");
  });

  it("falls back to audio/mp4 for Safari", () => {
    stubSupport(["audio/mp4"]);
    expect(pickRecorderMimeType()).toBe("audio/mp4");
  });

  it("throws when the browser supports nothing in the candidate list", () => {
    stubSupport([]);
    expect(() => pickRecorderMimeType()).toThrow(
      /No supported MediaRecorder MIME type/,
    );
  });
});
