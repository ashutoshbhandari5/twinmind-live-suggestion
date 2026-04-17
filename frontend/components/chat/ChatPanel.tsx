import { ColumnHeader } from "@/components/layout/ColumnHeader";
import { Card, CardContent } from "@/components/ui/card";
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
        <Card>
          <CardContent className="text-xs text-muted-foreground">
            Click a suggestion or type a question below.
          </CardContent>
        </Card>
      </div>
      <ChatInput />
    </div>
  );
}
