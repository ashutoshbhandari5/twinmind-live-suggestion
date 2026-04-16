import { ColumnHeader } from "@/components/layout/ColumnHeader";
import { MicButton } from "./MicButton";
import { TranscriptFeed } from "./TranscriptFeed";

export function TranscriptPanel() {
  return (
    <div className="flex h-full flex-col">
      <ColumnHeader index={1} title="Mic & Transcript" right="IDLE" />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <MicButton />
        <TranscriptFeed />
      </div>
    </div>
  );
}
