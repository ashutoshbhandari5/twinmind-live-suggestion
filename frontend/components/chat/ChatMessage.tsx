"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "@/lib/types";
import { TypeBadge } from "@/components/suggestions/TypeBadge";
import { AssistantMarkdown } from "./AssistantMarkdown";

type Props = {
  message: ChatMessageType;
  isLastStreaming?: boolean;
  showInterruptedPill?: boolean;
};

export function ChatMessage({
  message,
  isLastStreaming = false,
  showInterruptedPill = false,
}: Props) {
  if (message.role === "user") return <UserMessage message={message} />;
  return (
    <AssistantMessage
      message={message}
      isLastStreaming={isLastStreaming}
      showInterruptedPill={showInterruptedPill}
    />
  );
}

function UserMessage({ message }: { message: ChatMessageType }) {
  const sourceType = message.sourceSuggestion?.type;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 text-[10px] tracking-widest text-muted-foreground">
        <span>YOU</span>
        {sourceType && <TypeBadge type={sourceType} />}
      </div>
      <Card>
        <CardContent className="p-3 text-sm leading-relaxed text-foreground">
          {message.content}
        </CardContent>
      </Card>
    </div>
  );
}

function AssistantMessage({
  message,
  isLastStreaming,
  showInterruptedPill,
}: {
  message: ChatMessageType;
  isLastStreaming: boolean;
  showInterruptedPill: boolean;
}) {
  const isEmpty = message.content.length === 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] tracking-widest text-muted-foreground">
        ASSISTANT
      </div>
      <Card>
        <CardContent className="p-3 text-sm">
          {isEmpty ? (
            <PlaceholderDots />
          ) : (
            <div className="text-foreground">
              <AssistantMarkdown>{message.content}</AssistantMarkdown>
              {isLastStreaming && (
                <span className="ml-0.5 inline-block animate-pulse">▍</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      {showInterruptedPill && (
        <div className="self-start rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] tracking-widest text-destructive">
          Connection interrupted
        </div>
      )}
    </div>
  );
}

function PlaceholderDots() {
  return (
    <div className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            "size-1.5 rounded-full bg-muted-foreground/60 animate-pulse",
          )}
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}
