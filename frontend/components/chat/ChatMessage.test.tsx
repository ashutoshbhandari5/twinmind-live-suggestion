import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ChatMessage as ChatMessageType } from "@/lib/types";
import { ChatMessage } from "./ChatMessage";

function userMsg(overrides: Partial<ChatMessageType> = {}): ChatMessageType {
  return {
    id: "u1",
    role: "user",
    content: "Hello",
    timestamp: 0,
    ...overrides,
  };
}

function assistantMsg(
  overrides: Partial<ChatMessageType> = {},
): ChatMessageType {
  return {
    id: "a1",
    role: "assistant",
    content: "Hi back",
    timestamp: 0,
    ...overrides,
  };
}

describe("ChatMessage user variant", () => {
  it("renders YOU label and content", () => {
    render(<ChatMessage message={userMsg()} />);
    expect(screen.getByText("YOU")).toBeInTheDocument();
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("renders the source-suggestion type badge when present", () => {
    render(
      <ChatMessage
        message={userMsg({
          sourceSuggestion: { type: "answer", preview: "x", reasoning: "r" },
        })}
      />,
    );
    expect(screen.getByText("ANSWER")).toBeInTheDocument();
  });

  it("does not render a badge for plain typed messages", () => {
    render(<ChatMessage message={userMsg()} />);
    expect(screen.queryByText("ANSWER")).not.toBeInTheDocument();
  });
});

describe("ChatMessage assistant variant", () => {
  it("renders ASSISTANT label", () => {
    render(<ChatMessage message={assistantMsg()} />);
    expect(screen.getByText("ASSISTANT")).toBeInTheDocument();
  });

  it("shows pulsing dots when content is empty (placeholder)", () => {
    const { container } = render(
      <ChatMessage message={assistantMsg({ content: "" })} />,
    );
    const dots = container.querySelectorAll(".animate-pulse");
    expect(dots.length).toBeGreaterThanOrEqual(3);
  });

  it("renders markdown content when present", () => {
    render(<ChatMessage message={assistantMsg({ content: "**bold** text" })} />);
    expect(screen.getByText("bold").tagName).toBe("STRONG");
  });

  it("shows the streaming cursor only when isLastStreaming", () => {
    const { container, rerender } = render(
      <ChatMessage message={assistantMsg()} isLastStreaming />,
    );
    expect(container.textContent).toContain("▍");
    rerender(<ChatMessage message={assistantMsg()} />);
    expect(container.textContent).not.toContain("▍");
  });

  it("shows the interrupted pill when showInterruptedPill is true", () => {
    render(<ChatMessage message={assistantMsg()} showInterruptedPill />);
    expect(screen.getByText(/Connection interrupted/i)).toBeInTheDocument();
  });

  it("does not show the pill by default", () => {
    render(<ChatMessage message={assistantMsg()} />);
    expect(screen.queryByText(/Connection interrupted/i)).not.toBeInTheDocument();
  });
});
