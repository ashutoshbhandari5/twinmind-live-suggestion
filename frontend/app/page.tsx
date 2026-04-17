import Link from "next/link";
import { ThreeColumnLayout } from "@/components/layout/ThreeColumnLayout";
import { TranscriptPanel } from "@/components/transcript/TranscriptPanel";
import { SuggestionsPanel } from "@/components/suggestions/SuggestionsPanel";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { ExportButton } from "@/components/shared/ExportButton";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <h1 className="text-sm font-medium tracking-wide">
          TwinMind — Live Suggestions
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/settings"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Settings
          </Link>
          <ExportButton />
        </div>
      </header>
      <ThreeColumnLayout
        left={<TranscriptPanel />}
        separator={<Separator orientation="vertical" />}
        middle={<SuggestionsPanel />}
        right={<ChatPanel />}
      />
    </div>
  );
}
