import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { useSessionStore } from "@/lib/store";
import type { Suggestion } from "@/lib/types";
import { SuggestionCard } from "./SuggestionCard";

const SUGGESTION: Suggestion = {
  id: "s_1",
  type: "answer",
  preview: "Our p99 is 120ms on websockets.",
  reasoning: "directly answers",
};

beforeEach(() => {
  useSessionStore.getState().reset();
});

describe("SuggestionCard render", () => {
  it("renders the preview text", () => {
    render(<SuggestionCard suggestion={SUGGESTION} />);
    expect(
      screen.getByText("Our p99 is 120ms on websockets."),
    ).toBeInTheDocument();
  });

  it("renders the type badge", () => {
    render(<SuggestionCard suggestion={SUGGESTION} />);
    expect(screen.getByText("ANSWER")).toBeInTheDocument();
  });
});

describe("SuggestionCard highlighting", () => {
  it("applies a colored ring when highlighted", () => {
    const { container } = render(
      <SuggestionCard suggestion={SUGGESTION} highlighted />,
    );
    expect(container.innerHTML).toMatch(/ring-green-500/);
  });

  it("reduces opacity when not highlighted (older batch)", () => {
    const { container } = render(
      <SuggestionCard suggestion={SUGGESTION} />,
    );
    const button = container.querySelector("button");
    expect(button?.className).toMatch(/opacity-60/);
  });

  it("does not reduce opacity when highlighted", () => {
    const { container } = render(
      <SuggestionCard suggestion={SUGGESTION} highlighted />,
    );
    const button = container.querySelector("button");
    expect(button?.className).not.toMatch(/opacity-60/);
  });
});

describe("SuggestionCard click", () => {
  it("appends a user ChatMessage with sourceSuggestion on click", async () => {
    const user = userEvent.setup();
    render(<SuggestionCard suggestion={SUGGESTION} />);
    await user.click(screen.getByRole("button"));
    const msgs = useSessionStore.getState().chatMessages;
    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe("user");
    expect(msgs[0].content).toBe(SUGGESTION.preview);
    expect(msgs[0].sourceSuggestion).toEqual({
      type: "answer",
      preview: SUGGESTION.preview,
      reasoning: SUGGESTION.reasoning,
    });
  });

  it("appends one message per click (no dedupe)", async () => {
    const user = userEvent.setup();
    render(<SuggestionCard suggestion={SUGGESTION} />);
    const btn = screen.getByRole("button");
    await user.click(btn);
    await user.click(btn);
    expect(useSessionStore.getState().chatMessages).toHaveLength(2);
  });
});
