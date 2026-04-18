import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AssistantMarkdown } from "./AssistantMarkdown";

describe("AssistantMarkdown rendering", () => {
  it("renders paragraphs", () => {
    render(<AssistantMarkdown>{"Hello world"}</AssistantMarkdown>);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("renders bold and italic", () => {
    const { container } = render(
      <AssistantMarkdown>{"**bold** and *italic*"}</AssistantMarkdown>,
    );
    expect(container.querySelector("strong")?.textContent).toBe("bold");
    expect(container.querySelector("em")?.textContent).toBe("italic");
  });

  it("renders bullet lists", () => {
    const { container } = render(
      <AssistantMarkdown>{"- one\n- two\n- three"}</AssistantMarkdown>,
    );
    const items = container.querySelectorAll("li");
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toBe("one");
  });

  it("renders inline code", () => {
    const { container } = render(
      <AssistantMarkdown>{"use `console.log` here"}</AssistantMarkdown>,
    );
    expect(container.querySelector("code")?.textContent).toBe("console.log");
  });

  it("renders fenced code blocks with monospace styling", () => {
    const { container } = render(
      <AssistantMarkdown>
        {"```js\nconsole.log('hi')\n```"}
      </AssistantMarkdown>,
    );
    expect(container.querySelector("pre")).not.toBeNull();
    expect(container.querySelector("pre code")?.textContent).toMatch(
      /console\.log/,
    );
  });

  it("renders tables via remark-gfm", () => {
    const md = "| a | b |\n|---|---|\n| 1 | 2 |";
    const { container } = render(<AssistantMarkdown>{md}</AssistantMarkdown>);
    expect(container.querySelector("table")).not.toBeNull();
    expect(container.querySelectorAll("td")).toHaveLength(2);
  });
});

describe("AssistantMarkdown security", () => {
  it("forces links to open in a new tab with safe rel", () => {
    const { container } = render(
      <AssistantMarkdown>{"[link](https://example.com)"}</AssistantMarkdown>,
    );
    const a = container.querySelector("a");
    expect(a?.getAttribute("target")).toBe("_blank");
    expect(a?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("drops images entirely", () => {
    const { container } = render(
      <AssistantMarkdown>
        {"![alt](https://example.com/x.png)"}
      </AssistantMarkdown>,
    );
    expect(container.querySelector("img")).toBeNull();
  });

  it("treats raw HTML as literal text (skipHtml)", () => {
    const { container } = render(
      <AssistantMarkdown>
        {"<script>alert('x')</script>"}
      </AssistantMarkdown>,
    );
    expect(container.querySelector("script")).toBeNull();
  });
});
