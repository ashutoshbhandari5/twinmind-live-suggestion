"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSessionStore } from "@/lib/store";
import { TranscriptChunk } from "./TranscriptChunk";

export function TranscriptFeed() {
  const transcript = useSessionStore((s) => s.transcript);
  const isRecording = useSessionStore((s) => s.isRecording);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [transcript.length]);

  if (transcript.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
        {isRecording
          ? "Listening..."
          : "Start recording to see the transcript."}
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="flex flex-col px-1">
        {transcript.map((c) => (
          <TranscriptChunk key={c.id} chunk={c} />
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
