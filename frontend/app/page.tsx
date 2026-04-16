import Link from "next/link";
import { ThreeColumnLayout } from "@/components/layout/ThreeColumnLayout";
import { TranscriptPanel } from "@/components/transcript/TranscriptPanel";
import { SuggestionsPanel } from "@/components/suggestions/SuggestionsPanel";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { ExportButton } from "@/components/shared/ExportButton";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-3">
        <h1 className="text-sm font-medium tracking-wide text-zinc-100">
          TwinMind — Live Suggestions
        </h1>
        <div className="flex items-center gap-3">
          <Link
            href="/settings"
            className="text-xs text-zinc-400 hover:text-zinc-100"
          >
            Settings
          </Link>
          <ExportButton />
        </div>
      </header>
      <ThreeColumnLayout
        left={<TranscriptPanel />}
        middle={<SuggestionsPanel />}
        right={<ChatPanel />}
      />
    </div>
  );
}
