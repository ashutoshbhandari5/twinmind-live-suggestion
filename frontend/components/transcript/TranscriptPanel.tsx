"use client";

import type { ReactNode } from "react";
import { ColumnHeader } from "@/components/layout/ColumnHeader";
import { useSessionStore } from "@/lib/store";
import { MicButton } from "./MicButton";
import { TranscriptFeed } from "./TranscriptFeed";

function statusLabel(
  isRecording: boolean,
  micPermission: "unknown" | "granted" | "denied",
  recorderError: "none" | "auto-stopped",
): ReactNode {
  if (recorderError === "auto-stopped") return "ERROR";
  if (micPermission === "denied") return "DENIED";
  if (isRecording) {
    return (
      <span>
        <span className="text-red-500">●</span> RECORDING
      </span>
    );
  }
  return "IDLE";
}

export function TranscriptPanel() {
  const isRecording = useSessionStore((s) => s.isRecording);
  const micPermission = useSessionStore((s) => s.micPermission);
  const recorderError = useSessionStore((s) => s.recorderError);

  return (
    <div className="flex h-full flex-col">
      <ColumnHeader
        index={1}
        title="Mic & Transcript"
        right={statusLabel(isRecording, micPermission, recorderError)}
      />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <MicButton />
        <TranscriptFeed />
      </div>
    </div>
  );
}
