import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionStore } from "./store";
import {
  APP_VERSION,
  buildExportFile,
  buildExportFilename,
  downloadExport,
} from "./export";

beforeEach(() => {
  useSessionStore.getState().reset();
});

describe("buildExportFilename", () => {
  it("formats a standard datetime correctly", () => {
    const d = new Date(2026, 3, 17, 22, 30); // Apr 17 2026, 10:30 PM local
    expect(buildExportFilename(d)).toBe("twinmind-session-2026-04-17-2230.json");
  });

  it("zero-pads single-digit month, day, hour, and minute", () => {
    const d = new Date(2026, 0, 3, 9, 5); // Jan 3 2026, 9:05 AM local
    expect(buildExportFilename(d)).toBe("twinmind-session-2026-01-03-0905.json");
  });

  it("handles December correctly (month is 1-indexed in output)", () => {
    const d = new Date(2026, 11, 31, 23, 59);
    expect(buildExportFilename(d)).toBe("twinmind-session-2026-12-31-2359.json");
  });

  it("handles midnight as 0000", () => {
    const d = new Date(2026, 5, 15, 0, 0);
    expect(buildExportFilename(d)).toBe("twinmind-session-2026-06-15-0000.json");
  });
});

describe("buildExportFile envelope", () => {
  it("sets exportedAt to now.getTime()", () => {
    const d = new Date(2026, 3, 17, 22, 30, 15);
    const file = buildExportFile(d);
    expect(file.exportedAt).toBe(d.getTime());
  });

  it("renders exportedAtReadable in en-US clock format", () => {
    const d = new Date(2026, 3, 17, 22, 30, 15);
    const file = buildExportFile(d);
    // "04/17/2026, 10:30:15 PM" with optional NNBSP before AM/PM
    expect(file.exportedAtReadable).toMatch(/04\/17\/2026, 10:30:15\s?PM/);
  });

  it("includes the hardcoded APP_VERSION", () => {
    const file = buildExportFile();
    expect(file.appVersion).toBe(APP_VERSION);
    expect(file.appVersion).toBe("0.1.0");
  });
});

describe("buildExportFile sessionStartedAt and duration", () => {
  it("when sessionStartedAt is null, readable is null and duration is 0", () => {
    const file = buildExportFile();
    expect(file.sessionStartedAt).toBeNull();
    expect(file.sessionStartedAtReadable).toBeNull();
    expect(file.sessionDurationMs).toBe(0);
  });

  it("when sessionStartedAt is set, computes duration as exportedAt - sessionStartedAt", () => {
    const startedAt = new Date(2026, 3, 17, 22, 0, 0).getTime();
    useSessionStore.setState({ recordingStartedAt: startedAt });
    const exportedAt = new Date(2026, 3, 17, 22, 5, 30); // 5:30 later
    const file = buildExportFile(exportedAt);
    expect(file.sessionStartedAt).toBe(startedAt);
    expect(file.sessionDurationMs).toBe(330_000); // 5m 30s
    expect(file.sessionStartedAtReadable).toMatch(/04\/17\/2026, 10:00:00\s?PM/);
  });
});

describe("buildExportFile note field", () => {
  it("emits note when all three arrays are empty", () => {
    const file = buildExportFile();
    expect(file.note).toBe("No session data recorded");
  });

  it("omits note when transcript has any entry", () => {
    useSessionStore.getState().addTranscriptChunk({
      id: "c_1",
      text: "hi",
      timestamp: 0,
    });
    const file = buildExportFile();
    expect(file.note).toBeUndefined();
  });

  it("omits note when suggestionBatches has any entry", () => {
    useSessionStore.getState().addSuggestionBatch({
      id: "b_1",
      timestamp: 0,
      momentType: "idle",
      suggestions: [],
    });
    const file = buildExportFile();
    expect(file.note).toBeUndefined();
  });

  it("omits note when chatMessages has any entry", () => {
    useSessionStore.getState().addChatMessage({
      id: "m_1",
      role: "user",
      content: "hi",
      timestamp: 0,
    });
    const file = buildExportFile();
    expect(file.note).toBeUndefined();
  });

  it("note rule is independent of sessionStartedAt", () => {
    useSessionStore.setState({ recordingStartedAt: 12345 });
    const file = buildExportFile();
    // All arrays still empty: note still present.
    expect(file.note).toBe("No session data recorded");
  });
});

describe("buildExportFile transcript", () => {
  it("copies every chunk and adds timestampReadable", () => {
    const ts = new Date(2026, 3, 17, 13, 7, 54).getTime();
    useSessionStore.getState().addTranscriptChunk({
      id: "c_1",
      text: "hello world",
      timestamp: ts,
    });
    const file = buildExportFile();
    expect(file.transcript).toHaveLength(1);
    expect(file.transcript[0]).toMatchObject({
      id: "c_1",
      text: "hello world",
      timestamp: ts,
    });
    expect(file.transcript[0].timestampReadable).toMatch(
      /04\/17\/2026, 01:07:54\s?PM/,
    );
  });

  it("preserves ordering", () => {
    const s = useSessionStore.getState();
    s.addTranscriptChunk({ id: "a", text: "alpha", timestamp: 1 });
    s.addTranscriptChunk({ id: "b", text: "bravo", timestamp: 2 });
    const file = buildExportFile();
    expect(file.transcript.map((c) => c.id)).toEqual(["a", "b"]);
  });
});

describe("buildExportFile suggestionBatches", () => {
  it("copies every batch with momentType and per-batch readable timestamp", () => {
    useSessionStore.getState().addSuggestionBatch({
      id: "b_1",
      timestamp: new Date(2026, 3, 17, 14, 0, 0).getTime(),
      momentType: "claim_made",
      suggestions: [
        { id: "s_1", type: "answer", preview: "p", reasoning: "r" },
      ],
    });
    const file = buildExportFile();
    expect(file.suggestionBatches).toHaveLength(1);
    expect(file.suggestionBatches[0]).toMatchObject({
      id: "b_1",
      momentType: "claim_made",
    });
    expect(file.suggestionBatches[0].timestampReadable).toMatch(
      /04\/17\/2026, 02:00:00\s?PM/,
    );
    expect(file.suggestionBatches[0].suggestions[0]).toEqual({
      id: "s_1",
      type: "answer",
      preview: "p",
      reasoning: "r",
    });
  });

  it("preserves newest-first ordering from the store", () => {
    const s = useSessionStore.getState();
    s.addSuggestionBatch({
      id: "b1",
      timestamp: 1,
      momentType: "idle",
      suggestions: [],
    });
    s.addSuggestionBatch({
      id: "b2",
      timestamp: 2,
      momentType: "idle",
      suggestions: [],
    });
    const file = buildExportFile();
    // Store prepends newest at index 0.
    expect(file.suggestionBatches.map((b) => b.id)).toEqual(["b2", "b1"]);
  });
});

describe("buildExportFile chatMessages", () => {
  it("copies every message with timestampReadable", () => {
    const ts = new Date(2026, 3, 17, 15, 0, 0).getTime();
    useSessionStore.getState().addChatMessage({
      id: "m_1",
      role: "user",
      content: "hello",
      timestamp: ts,
    });
    const file = buildExportFile();
    expect(file.chatMessages).toHaveLength(1);
    expect(file.chatMessages[0]).toMatchObject({
      id: "m_1",
      role: "user",
      content: "hello",
      timestamp: ts,
    });
    expect(file.chatMessages[0].timestampReadable).toMatch(
      /04\/17\/2026, 03:00:00\s?PM/,
    );
  });

  it("includes sourceSuggestion when present", () => {
    useSessionStore.getState().addChatMessage({
      id: "m_1",
      role: "user",
      content: "p",
      timestamp: 0,
      sourceSuggestion: {
        type: "answer",
        preview: "p",
        reasoning: "r",
      },
    });
    const file = buildExportFile();
    expect(file.chatMessages[0].sourceSuggestion).toEqual({
      type: "answer",
      preview: "p",
      reasoning: "r",
    });
  });

  it("omits sourceSuggestion entirely when not set (not null, not undefined key)", () => {
    useSessionStore.getState().addChatMessage({
      id: "m_1",
      role: "user",
      content: "typed",
      timestamp: 0,
    });
    const file = buildExportFile();
    expect("sourceSuggestion" in file.chatMessages[0]).toBe(false);
    // And the serialized JSON does not contain the key either.
    const json = JSON.stringify(file);
    expect(json).not.toContain("sourceSuggestion");
  });

  it("preserves chat ordering (oldest first as appended)", () => {
    const s = useSessionStore.getState();
    s.addChatMessage({ id: "u", role: "user", content: "q", timestamp: 1 });
    s.addChatMessage({ id: "a", role: "assistant", content: "r", timestamp: 2 });
    const file = buildExportFile();
    expect(file.chatMessages.map((m) => m.id)).toEqual(["u", "a"]);
  });
});

describe("buildExportFile is JSON-safe", () => {
  it("produces valid JSON when all arrays are populated", () => {
    const s = useSessionStore.getState();
    s.startRecording();
    s.addTranscriptChunk({ id: "c", text: "hi", timestamp: 0 });
    s.addSuggestionBatch({
      id: "b",
      timestamp: 0,
      momentType: "idle",
      suggestions: [
        { id: "s", type: "answer", preview: "p", reasoning: "r" },
      ],
    });
    s.addChatMessage({ id: "m", role: "user", content: "q", timestamp: 0 });
    const file = buildExportFile();
    const json = JSON.stringify(file, null, 2);
    expect(() => JSON.parse(json)).not.toThrow();
    const round = JSON.parse(json);
    expect(round.transcript).toHaveLength(1);
    expect(round.suggestionBatches).toHaveLength(1);
    expect(round.chatMessages).toHaveLength(1);
  });
});

describe("downloadExport", () => {
  let createObjectURLMock: ReturnType<typeof vi.fn>;
  let revokeObjectURLMock: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.spyOn>;
  let lastAnchor: HTMLAnchorElement | null;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const originalCreateElement = document.createElement.bind(document);

  function lastCreatedAnchor(): HTMLAnchorElement | null {
    return lastAnchor;
  }

  beforeEach(() => {
    createObjectURLMock = vi.fn(() => "blob:fake-url");
    revokeObjectURLMock = vi.fn();
    URL.createObjectURL = createObjectURLMock as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeObjectURLMock as typeof URL.revokeObjectURL;

    clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    // vi.spyOn(document, "createElement") trips on the heavily-overloaded
    // signature. Wrap the original directly to capture the anchor.
    lastAnchor = null;
    document.createElement = ((tag: string, opts?: ElementCreationOptions) => {
      const el = originalCreateElement(tag, opts);
      if (tag === "a") lastAnchor = el as HTMLAnchorElement;
      return el;
    }) as typeof document.createElement;
  });

  afterEach(() => {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    document.createElement = originalCreateElement as typeof document.createElement;
    clickSpy.mockRestore();
  });

  it("creates a Blob with application/json type", () => {
    downloadExport(new Date(2026, 3, 17, 22, 30));
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    const blob = createObjectURLMock.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("application/json");
  });

  it("triggers a click on an anchor with the right filename", () => {
    downloadExport(new Date(2026, 3, 17, 22, 30));
    expect(clickSpy).toHaveBeenCalledTimes(1);
    const anchor = lastCreatedAnchor();
    expect(anchor?.download).toBe("twinmind-session-2026-04-17-2230.json");
    expect(anchor?.href).toContain("blob:fake-url");
  });

  it("revokes the blob URL after a delay", () => {
    vi.useFakeTimers();
    try {
      downloadExport();
      expect(revokeObjectURLMock).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1500);
      expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:fake-url");
    } finally {
      vi.useRealTimers();
    }
  });

  it("removes the anchor from the DOM after click", () => {
    downloadExport();
    // No leftover anchors with a blob: href.
    const leftover = document.querySelectorAll("a[href^='blob:']");
    expect(leftover).toHaveLength(0);
  });

  it("serializes a valid JSON envelope into the blob", async () => {
    let captured: Blob | null = null;
    createObjectURLMock.mockImplementation((b: Blob) => {
      captured = b;
      return "blob:fake-url";
    });
    downloadExport(new Date(2026, 3, 17, 22, 30, 15));
    expect(captured).not.toBeNull();

    // jsdom's Blob lacks .text(); read via FileReader for a portable path.
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(captured as unknown as Blob);
    });
    const parsed = JSON.parse(text);
    expect(parsed.appVersion).toBe(APP_VERSION);
    expect(typeof parsed.exportedAt).toBe("number");
    expect(parsed.exportedAtReadable).toMatch(
      /04\/17\/2026, 10:30:15\s?PM/,
    );
    expect(parsed.note).toBe("No session data recorded");
  });
});
