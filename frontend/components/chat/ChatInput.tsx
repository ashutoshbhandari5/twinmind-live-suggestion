"use client";

import { useState, type KeyboardEvent } from "react";
import { Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSessionStore } from "@/lib/store";

export function ChatInput() {
  const [draft, setDraft] = useState("");
  const isStreaming = useSessionStore((s) => s.isStreamingChat);

  function submit(): void {
    const text = draft.trim();
    if (!text || isStreaming) return;
    useSessionStore.getState().addChatMessage({
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    });
    setDraft("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex items-end gap-2 border-t border-border p-3">
      <Textarea
        rows={3}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask anything... (Enter to send, Shift+Enter for newline)"
        disabled={isStreaming}
        className="resize-none"
      />
      <Button
        type="button"
        onClick={submit}
        disabled={isStreaming || draft.trim() === ""}
        aria-label={isStreaming ? "Streaming" : "Send"}
      >
        {isStreaming ? (
          <Square className="size-4" />
        ) : (
          <Send className="size-4" />
        )}
      </Button>
    </div>
  );
}
