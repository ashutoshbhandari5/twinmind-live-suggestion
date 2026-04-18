"use client";

import { useEffect, useRef } from "react";
import { ColumnHeader } from "@/components/layout/ColumnHeader";
import { Card, CardContent } from "@/components/ui/card";
import { useSessionStore } from "@/lib/store";
import { ChatInput } from "./ChatInput";
import { ChatMessage } from "./ChatMessage";

export function ChatPanel() {
  const messages = useSessionStore((s) => s.chatMessages);
  const isStreaming = useSessionStore((s) => s.isStreamingChat);
  const chatError = useSessionStore((s) => s.chatError);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, isStreaming]);

  const lastIndex = messages.length - 1;
  const lastIsAssistant =
    lastIndex >= 0 && messages[lastIndex].role === "assistant";

  return (
    <div className="flex h-full flex-col">
      <ColumnHeader
        index={3}
        title="Chat (Detailed Answers)"
        right="SESSION-ONLY"
      />
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 min-h-0">
        {messages.length === 0 ? (
          <Card>
            <CardContent className="p-3 text-xs text-muted-foreground">
              Click a suggestion or type a question below.
            </CardContent>
          </Card>
        ) : (
          messages.map((m, i) => (
            <ChatMessage
              key={m.id}
              message={m}
              isLastStreaming={
                isStreaming && i === lastIndex && lastIsAssistant
              }
              showInterruptedPill={
                chatError === "interrupted" &&
                i === lastIndex &&
                lastIsAssistant
              }
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>
      <ChatInput />
    </div>
  );
}
