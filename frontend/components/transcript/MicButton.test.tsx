import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionStore } from "@/lib/store";
import { useSettingsStore } from "@/lib/settings-store";
import { MicButton } from "./MicButton";

const startMock = vi.fn(async () => {});
const stopMock = vi.fn(async () => {});
const flushNowMock = vi.fn(async () => {});

const mockRecorder = {
  start: startMock,
  stop: stopMock,
  flushNow: flushNowMock,
};

const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

beforeEach(() => {
  useSessionStore.getState().reset();
  useSettingsStore.setState({ groqApiKey: "" });
  startMock.mockClear();
  stopMock.mockClear();
  toastErrorMock.mockClear();
});

describe("MicButton click guards", () => {
  it("toasts and does not start when Groq key is empty", async () => {
    const user = userEvent.setup();
    render(<MicButton recorder={mockRecorder} />);
    await user.click(screen.getByRole("button"));
    expect(startMock).not.toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalled();
    const message = toastErrorMock.mock.calls[0][0] as string;
    expect(message).toMatch(/Groq API key/i);
  });

  it("calls recorder.start when key is present and not recording", async () => {
    useSettingsStore.setState({ groqApiKey: "sk-test" });
    const user = userEvent.setup();
    render(<MicButton recorder={mockRecorder} />);
    await user.click(screen.getByRole("button"));
    expect(startMock).toHaveBeenCalledTimes(1);
  });

  it("calls recorder.stop when clicked while recording", async () => {
    useSettingsStore.setState({ groqApiKey: "sk-test" });
    useSessionStore.getState().startRecording();
    const user = userEvent.setup();
    render(<MicButton recorder={mockRecorder} />);
    await user.click(screen.getByRole("button"));
    expect(stopMock).toHaveBeenCalledTimes(1);
  });
});

describe("MicButton disabled states", () => {
  it("is disabled when mic permission is denied", () => {
    useSessionStore.getState().setMicPermission("denied");
    render(<MicButton recorder={mockRecorder} />);
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByText(/Microphone blocked/i)).toBeInTheDocument();
  });

  it("is disabled after 3-strike auto-stop", () => {
    useSessionStore.getState().setRecorderError("auto-stopped");
    render(<MicButton recorder={mockRecorder} />);
    expect(screen.getByRole("button")).toBeDisabled();
    expect(
      screen.getByText(/Recording stopped after 3 failed transcriptions/i),
    ).toBeInTheDocument();
  });

  it("click is a no-op while disabled (auto-stopped)", async () => {
    useSettingsStore.setState({ groqApiKey: "sk-test" });
    useSessionStore.getState().setRecorderError("auto-stopped");
    const user = userEvent.setup();
    render(<MicButton recorder={mockRecorder} />);
    await user.click(screen.getByRole("button"));
    expect(startMock).not.toHaveBeenCalled();
    expect(stopMock).not.toHaveBeenCalled();
  });
});

describe("MicButton status text", () => {
  it("says 'Stopped. Click to resume.' when idle with key present", () => {
    useSettingsStore.setState({ groqApiKey: "sk-test" });
    render(<MicButton recorder={mockRecorder} />);
    expect(
      screen.getByText(/Stopped\.\s*Click to resume/i),
    ).toBeInTheDocument();
  });

  it("says 'Listening...' while recording", () => {
    useSettingsStore.setState({ groqApiKey: "sk-test" });
    useSessionStore.getState().startRecording();
    render(<MicButton recorder={mockRecorder} />);
    expect(
      screen.getByText(/Listening.*transcript updates/i),
    ).toBeInTheDocument();
  });

  it("nudges to Settings when key is empty", () => {
    render(<MicButton recorder={mockRecorder} />);
    expect(
      screen.getByText(/Add your Groq API key in Settings/i),
    ).toBeInTheDocument();
  });
});
