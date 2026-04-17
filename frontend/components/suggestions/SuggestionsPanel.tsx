import { ColumnHeader } from "@/components/layout/ColumnHeader";
import { Card, CardContent } from "@/components/ui/card";
import { ReloadButton } from "./ReloadButton";

export function SuggestionsPanel() {
  return (
    <div className="flex h-full flex-col">
      <ColumnHeader index={2} title="Live Suggestions" right="0 BATCHES" />
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <ReloadButton />
        <span className="text-[10px] tracking-widest text-muted-foreground">
          auto-refresh in 30s
        </span>
      </div>
      <div className="flex-1 p-4">
        <Card>
          <CardContent className="text-xs text-muted-foreground">
            Suggestions appear here once recording starts.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
