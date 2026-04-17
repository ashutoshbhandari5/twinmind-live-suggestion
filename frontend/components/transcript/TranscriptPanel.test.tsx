import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionStore } from "@/lib/store";
import { TranscriptPanel } from "./TranscriptPanel";

// MicButton renders the real recorder-driven UI; stub it here because the
// panel test only cares about the status chip wiring.
vi.mock("./MicButton", () => ({
  MicButton: () => <div data-testid="mic" />,
}));
vi.mock("./TranscriptFeed", () => ({
  TranscriptFeed: () => <div data-testid="feed" />,
}));

const mockRecorder = {
  start: vi.fn(async () => {}),
  stop: vi.fn(async () => {}),
  flushNow: vi.fn(async () => {}),
};

beforeEach(() => {
  useSessionStore.getState().reset();
});

describe("TranscriptPanel status chip", () => {
  it("shows IDLE by default", () => {
    render(<TranscriptPanel recorder={mockRecorder} />);
    expect(screen.getByText("IDLE")).toBeInTheDocument();
  });

  it("shows RECORDING when isRecording is true", () => {
    useSessionStore.getState().startRecording();
    render(<TranscriptPanel recorder={mockRecorder} />);
    expect(screen.getByText(/RECORDING/)).toBeInTheDocument();
  });

  it("shows DENIED when mic permission is denied", () => {
    useSessionStore.getState().setMicPermission("denied");
    render(<TranscriptPanel recorder={mockRecorder} />);
    expect(screen.getByText("DENIED")).toBeInTheDocument();
  });

  it("shows ERROR when recorder has auto-stopped", () => {
    useSessionStore.getState().setRecorderError("auto-stopped");
    render(<TranscriptPanel recorder={mockRecorder} />);
    expect(screen.getByText("ERROR")).toBeInTheDocument();
  });

  it("ERROR takes precedence over RECORDING state", () => {
    useSessionStore.getState().startRecording();
    useSessionStore.getState().setRecorderError("auto-stopped");
    render(<TranscriptPanel recorder={mockRecorder} />);
    expect(screen.getByText("ERROR")).toBeInTheDocument();
  });

  it("DENIED takes precedence over RECORDING state", () => {
    useSessionStore.getState().startRecording();
    useSessionStore.getState().setMicPermission("denied");
    render(<TranscriptPanel recorder={mockRecorder} />);
    expect(screen.getByText("DENIED")).toBeInTheDocument();
  });
});
