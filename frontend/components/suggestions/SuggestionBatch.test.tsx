import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SuggestionBatch as Batch } from "@/lib/types";
import { SuggestionBatch } from "./SuggestionBatch";

function buildBatch(overrides: Partial<Batch> = {}): Batch {
  return {
    id: "b_1",
    timestamp: new Date(2026, 3, 17, 13, 8, 16).getTime(),
    momentType: "question_asked",
    suggestions: [
      {
        id: "s_1",
        type: "answer",
        preview: "alpha preview",
        reasoning: "r1",
      },
      {
        id: "s_2",
        type: "question",
        preview: "bravo preview",
        reasoning: "r2",
      },
      {
        id: "s_3",
        type: "talking_point",
        preview: "charlie preview",
        reasoning: "r3",
      },
    ],
    ...overrides,
  };
}

describe("SuggestionBatch divider", () => {
  it("renders batch number and timestamp", () => {
    render(<SuggestionBatch batch={buildBatch()} index={2} />);
    expect(screen.getByText(/BATCH 2/)).toBeInTheDocument();
    expect(screen.getByText(/1:08:16\s?PM/i)).toBeInTheDocument();
  });

  it("renders the moment label for each canonical value", () => {
    const { rerender } = render(
      <SuggestionBatch
        batch={buildBatch({ momentType: "question_asked" })}
        index={1}
      />,
    );
    expect(screen.getByText(/Question asked/)).toBeInTheDocument();

    rerender(
      <SuggestionBatch
        batch={buildBatch({ momentType: "claim_made" })}
        index={1}
      />,
    );
    expect(screen.getByText(/Claim made/)).toBeInTheDocument();

    rerender(
      <SuggestionBatch
        batch={buildBatch({ momentType: "decision_point" })}
        index={1}
      />,
    );
    expect(screen.getByText(/Decision point/)).toBeInTheDocument();

    rerender(
      <SuggestionBatch
        batch={buildBatch({ momentType: "topic_exploration" })}
        index={1}
      />,
    );
    expect(screen.getByText(/Topic exploration/)).toBeInTheDocument();

    rerender(
      <SuggestionBatch
        batch={buildBatch({ momentType: "unfamiliar_term" })}
        index={1}
      />,
    );
    expect(screen.getByText(/Unfamiliar term/)).toBeInTheDocument();

    rerender(
      <SuggestionBatch
        batch={buildBatch({ momentType: "idle" })}
        index={1}
      />,
    );
    expect(screen.getByText(/Idle/)).toBeInTheDocument();
  });
});

describe("SuggestionBatch cards", () => {
  it("renders all three suggestions", () => {
    render(<SuggestionBatch batch={buildBatch()} index={1} />);
    expect(screen.getByText("alpha preview")).toBeInTheDocument();
    expect(screen.getByText("bravo preview")).toBeInTheDocument();
    expect(screen.getByText("charlie preview")).toBeInTheDocument();
  });

  it("propagates highlighted to every card (visible ring when true)", () => {
    const { container } = render(
      <SuggestionBatch batch={buildBatch()} index={1} highlighted />,
    );
    // At least one card should carry a ring class.
    expect(container.innerHTML).toMatch(/ring-/);
  });

  it("applies opacity dimming when not highlighted", () => {
    const { container } = render(
      <SuggestionBatch batch={buildBatch()} index={1} />,
    );
    const buttons = container.querySelectorAll("button");
    buttons.forEach((b) => {
      expect(b.className).toMatch(/opacity-60/);
    });
  });
});
