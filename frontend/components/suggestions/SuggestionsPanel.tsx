import { ColumnHeader } from "@/components/layout/ColumnHeader";
import { ReloadButton } from "./ReloadButton";

export function SuggestionsPanel() {
  return (
    <div className="flex h-full flex-col">
      <ColumnHeader index={2} title="Live Suggestions" right="0 BATCHES" />
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <ReloadButton />
        <span className="text-[10px] tracking-widest text-zinc-500">
          auto-refresh in 30s
        </span>
      </div>
      <div className="flex-1 p-4">
        <div className="rounded border border-dashed border-zinc-700 p-4 text-xs text-zinc-500">
          Suggestions appear here once recording starts.
        </div>
      </div>
    </div>
  );
}
