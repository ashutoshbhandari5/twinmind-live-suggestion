"use client";

import { useState } from "react";
import { Loader2, Mic } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/lib/store";
import { useSettingsStore } from "@/lib/settings-store";
import type { RecorderHandle } from "@/hooks/useRecorder";

type Props = { recorder: RecorderHandle };

export function MicButton({ recorder }: Props) {
  const isRecording = useSessionStore((s) => s.isRecording);
  const micPermission = useSessionStore((s) => s.micPermission);
  const recorderError = useSessionStore((s) => s.recorderError);
  const groqApiKey = useSettingsStore((s) => s.groqApiKey);
  const refreshIntervalSeconds = useSettingsStore(
    (s) => s.refreshIntervalSeconds,
  );
  const [isRequesting, setIsRequesting] = useState(false);

  const isDenied = micPermission === "denied";
  const isAutoStopped = recorderError === "auto-stopped";
  const disabled = isDenied || isAutoStopped;

  async function handleClick(): Promise<void> {
    if (disabled || isRequesting) return;
    if (isRecording) {
      await recorder.stop();
      return;
    }
    if (groqApiKey === "") {
      toast.error("Add your Groq API key in Settings to start recording.", {
        action: {
          label: "Settings",
          onClick: () => {
            window.location.href = "/settings";
          },
        },
      });
      return;
    }
    setIsRequesting(true);
    try {
      await recorder.start();
    } finally {
      setIsRequesting(false);
    }
  }

  const button = (
    <Button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        "size-20 rounded-full p-0",
        !disabled && !isRecording && "bg-blue-500 text-white hover:bg-blue-600",
        !disabled &&
          isRecording &&
          "mic-pulse bg-red-500 text-white hover:bg-red-600",
        disabled && "bg-muted text-muted-foreground hover:bg-muted",
      )}
      aria-label={isRecording ? "Stop recording" : "Start recording"}
    >
      {isRequesting ? (
        <Loader2 className="size-7 animate-spin" />
      ) : (
        <Mic className="size-7" />
      )}
    </Button>
  );

  const statusText = isAutoStopped
    ? "Recording stopped after 3 failed transcriptions. Reload to try again."
    : isDenied
      ? "Microphone blocked. Enable access in browser settings."
      : isRecording
        ? `Listening... transcript updates every ${refreshIntervalSeconds}s.`
        : groqApiKey === ""
          ? "Add your Groq API key in Settings to start."
          : "Stopped. Click to resume.";

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      {button}
      <p className="text-center text-xs text-muted-foreground">{statusText}</p>
    </div>
  );
}
