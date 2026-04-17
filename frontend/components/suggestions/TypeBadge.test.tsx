import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SuggestionType } from "@/lib/types";
import { TypeBadge } from "./TypeBadge";

describe("TypeBadge", () => {
  it.each<[SuggestionType, string]>([
    ["question", "QUESTION"],
    ["talking_point", "TALKING POINT"],
    ["answer", "ANSWER"],
    ["fact_check", "FACT-CHECK"],
    ["clarification", "CLARIFICATION"],
  ])("renders the label for %s", (type, label) => {
    render(<TypeBadge type={type} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("applies a type-specific color class", () => {
    const { container } = render(<TypeBadge type="answer" />);
    const badge = container.firstElementChild as HTMLElement;
    // green-flavored classes are applied for "answer"
    expect(badge.className).toMatch(/green/);
  });
});
