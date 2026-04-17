import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TranscriptChunk } from "./TranscriptChunk";

describe("TranscriptChunk", () => {
  it("renders the chunk text", () => {
    render(
      <TranscriptChunk
        chunk={{ id: "a", text: "Hello, world.", timestamp: Date.now() }}
      />,
    );
    expect(screen.getByText("Hello, world.")).toBeInTheDocument();
  });

  it("renders a wall-clock timestamp in 12-hour format", () => {
    const d = new Date(2026, 0, 1, 13, 7, 54).getTime();
    render(
      <TranscriptChunk chunk={{ id: "a", text: "payload", timestamp: d }} />,
    );
    // Intl.DateTimeFormat may insert a narrow no-break space before AM/PM.
    // Hour is 2-digit to match the prototype: "01:07:54 PM".
    expect(screen.getByText(/01:07:54\s?PM/)).toBeInTheDocument();
  });

  it("renders empty-string text without crashing", () => {
    const { container } = render(
      <TranscriptChunk chunk={{ id: "a", text: "", timestamp: Date.now() }} />,
    );
    expect(container.querySelector("p")).not.toBeNull();
  });
});
