import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionStore } from "@/lib/store";
import { TranscriptPanel } from "./TranscriptPanel";

// MicButton instantiates useRecorder, which touches browser APIs jsdom lacks.
// This panel test only cares about the status chip wiring.
vi.mock("./MicButton", () => ({
  MicButton: () => <div data-testid="mic" />,
}));
vi.mock("./TranscriptFeed", () => ({
  TranscriptFeed: () => <div data-testid="feed" />,
}));

beforeEach(() => {
  useSessionStore.getState().reset();
});

describe("TranscriptPanel status chip", () => {
  it("shows IDLE by default", () => {
    render(<TranscriptPanel />);
    expect(screen.getByText("IDLE")).toBeInTheDocument();
  });

  it("shows RECORDING when isRecording is true", () => {
    useSessionStore.getState().startRecording();
    render(<TranscriptPanel />);
    expect(screen.getByText(/RECORDING/)).toBeInTheDocument();
  });

  it("shows DENIED when mic permission is denied", () => {
    useSessionStore.getState().setMicPermission("denied");
    render(<TranscriptPanel />);
    expect(screen.getByText("DENIED")).toBeInTheDocument();
  });

  it("shows ERROR when recorder has auto-stopped", () => {
    useSessionStore.getState().setRecorderError("auto-stopped");
    render(<TranscriptPanel />);
    expect(screen.getByText("ERROR")).toBeInTheDocument();
  });

  it("ERROR takes precedence over RECORDING state", () => {
    useSessionStore.getState().startRecording();
    useSessionStore.getState().setRecorderError("auto-stopped");
    render(<TranscriptPanel />);
    expect(screen.getByText("ERROR")).toBeInTheDocument();
  });

  it("DENIED takes precedence over RECORDING state", () => {
    useSessionStore.getState().startRecording();
    useSessionStore.getState().setMicPermission("denied");
    render(<TranscriptPanel />);
    expect(screen.getByText("DENIED")).toBeInTheDocument();
  });
});
