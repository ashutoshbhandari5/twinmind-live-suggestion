import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useSessionStore } from "@/lib/store";
import { TranscriptFeed } from "./TranscriptFeed";

beforeEach(() => {
  useSessionStore.getState().reset();
});

describe("TranscriptFeed empty states", () => {
  it("shows 'Start recording' prompt when idle and empty", () => {
    render(<TranscriptFeed />);
    expect(
      screen.getByText(/Start recording to see the transcript/i),
    ).toBeInTheDocument();
  });

  it("shows 'Listening...' when recording and empty", () => {
    useSessionStore.getState().startRecording();
    render(<TranscriptFeed />);
    expect(screen.getByText(/Listening/i)).toBeInTheDocument();
  });
});

describe("TranscriptFeed with chunks", () => {
  it("renders all chunks in capture order", () => {
    const s = useSessionStore.getState();
    s.addTranscriptChunk({
      id: "a",
      text: "alpha line",
      timestamp: Date.now(),
    });
    s.addTranscriptChunk({
      id: "b",
      text: "bravo line",
      timestamp: Date.now() + 1,
    });
    render(<TranscriptFeed />);
    const alpha = screen.getByText("alpha line");
    const bravo = screen.getByText("bravo line");
    expect(alpha).toBeInTheDocument();
    expect(bravo).toBeInTheDocument();
    // DOM order reflects append order.
    expect(
      alpha.compareDocumentPosition(bravo) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
