import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { useSessionStore } from "@/lib/store";
import { ChatInput } from "./ChatInput";

beforeEach(() => {
  useSessionStore.getState().reset();
});

describe("ChatInput submit", () => {
  it("appends a user message on Enter", async () => {
    const user = userEvent.setup();
    render(<ChatInput />);
    const textarea = screen.getByPlaceholderText(/Ask anything/i);
    await user.type(textarea, "What is up?");
    await user.keyboard("{Enter}");
    const msgs = useSessionStore.getState().chatMessages;
    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe("user");
    expect(msgs[0].content).toBe("What is up?");
  });

  it("clears the textarea after submit", async () => {
    const user = userEvent.setup();
    render(<ChatInput />);
    const textarea = screen.getByPlaceholderText(
      /Ask anything/i,
    ) as HTMLTextAreaElement;
    await user.type(textarea, "hi");
    await user.keyboard("{Enter}");
    expect(textarea.value).toBe("");
  });

  it("appends a user message when Send button is clicked", async () => {
    const user = userEvent.setup();
    render(<ChatInput />);
    await user.type(screen.getByPlaceholderText(/Ask anything/i), "hi there");
    await user.click(screen.getByRole("button", { name: /Send/ }));
    const msgs = useSessionStore.getState().chatMessages;
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe("hi there");
  });
});

describe("ChatInput guards", () => {
  it("does not submit on Shift+Enter (inserts newline instead)", async () => {
    const user = userEvent.setup();
    render(<ChatInput />);
    const textarea = screen.getByPlaceholderText(
      /Ask anything/i,
    ) as HTMLTextAreaElement;
    await user.type(textarea, "first line");
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    await user.type(textarea, "second line");
    expect(useSessionStore.getState().chatMessages).toHaveLength(0);
    expect(textarea.value).toContain("first line");
    expect(textarea.value).toContain("second line");
  });

  it("ignores empty submit", async () => {
    const user = userEvent.setup();
    render(<ChatInput />);
    await user.click(screen.getByPlaceholderText(/Ask anything/i));
    await user.keyboard("{Enter}");
    expect(useSessionStore.getState().chatMessages).toHaveLength(0);
  });

  it("ignores whitespace-only submit", async () => {
    const user = userEvent.setup();
    render(<ChatInput />);
    await user.type(screen.getByPlaceholderText(/Ask anything/i), "   ");
    await user.keyboard("{Enter}");
    expect(useSessionStore.getState().chatMessages).toHaveLength(0);
  });
});

describe("ChatInput streaming state", () => {
  it("disables textarea and Send button while streaming", () => {
    useSessionStore.setState({ isStreamingChat: true });
    render(<ChatInput />);
    expect(screen.getByPlaceholderText(/Ask anything/i)).toBeDisabled();
    expect(screen.getByRole("button", { name: /Streaming/i })).toBeDisabled();
  });

  it("aria-label flips to 'Streaming' when streaming", () => {
    useSessionStore.setState({ isStreamingChat: true });
    render(<ChatInput />);
    expect(
      screen.getByRole("button", { name: /Streaming/i }),
    ).toBeInTheDocument();
  });
});
