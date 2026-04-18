import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionStore } from "@/lib/store";
import { ChatPanel } from "./ChatPanel";

// ChatInput renders a real textarea + Button. Stubbed here so the panel test
// only validates message-list wiring.
vi.mock("./ChatInput", () => ({
  ChatInput: () => <div data-testid="chat-input" />,
}));

beforeEach(() => {
  useSessionStore.getState().reset();
});

describe("ChatPanel empty state", () => {
  it("shows the prompt-to-start hint when no messages", () => {
    render(<ChatPanel />);
    expect(
      screen.getByText(/Click a suggestion or type a question below/i),
    ).toBeInTheDocument();
  });
});

describe("ChatPanel messages", () => {
  it("renders all messages in order", () => {
    useSessionStore.setState({
      chatMessages: [
        { id: "u1", role: "user", content: "ask alpha", timestamp: 1 },
        { id: "a1", role: "assistant", content: "answer alpha", timestamp: 2 },
        { id: "u2", role: "user", content: "ask bravo", timestamp: 3 },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText("ask alpha")).toBeInTheDocument();
    expect(screen.getByText("answer alpha")).toBeInTheDocument();
    expect(screen.getByText("ask bravo")).toBeInTheDocument();
  });

  it("shows streaming cursor only on the last assistant when isStreamingChat", () => {
    useSessionStore.setState({
      chatMessages: [
        { id: "u1", role: "user", content: "ask", timestamp: 1 },
        { id: "a1", role: "assistant", content: "streaming...", timestamp: 2 },
      ],
      isStreamingChat: true,
    });
    const { container } = render(<ChatPanel />);
    expect(container.textContent).toContain("▍");
  });

  it("shows the interrupted pill on the last assistant when chatError set", () => {
    useSessionStore.setState({
      chatMessages: [
        { id: "u1", role: "user", content: "ask", timestamp: 1 },
        { id: "a1", role: "assistant", content: "partial", timestamp: 2 },
      ],
      chatError: "interrupted",
    });
    render(<ChatPanel />);
    expect(screen.getByText(/Connection interrupted/i)).toBeInTheDocument();
  });

  it("does not show the pill when chatError is none", () => {
    useSessionStore.setState({
      chatMessages: [
        { id: "u1", role: "user", content: "ask", timestamp: 1 },
        { id: "a1", role: "assistant", content: "ok", timestamp: 2 },
      ],
      chatError: "none",
    });
    render(<ChatPanel />);
    expect(screen.queryByText(/Connection interrupted/i)).not.toBeInTheDocument();
  });
});
