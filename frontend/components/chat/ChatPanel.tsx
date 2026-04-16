import { ColumnHeader } from "@/components/layout/ColumnHeader";
import { ChatInput } from "./ChatInput";

export function ChatPanel() {
  return (
    <div className="flex h-full flex-col">
      <ColumnHeader
        index={3}
        title="Chat (Detailed Answers)"
        right="SESSION-ONLY"
      />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="rounded border border-dashed border-zinc-700 p-4 text-xs text-zinc-500">
          Click a suggestion or type a question below.
        </div>
      </div>
      <ChatInput />
    </div>
  );
}
