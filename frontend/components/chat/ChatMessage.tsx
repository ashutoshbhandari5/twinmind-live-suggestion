import { Card, CardContent } from "@/components/ui/card";
import type { ChatMessage as ChatMessageType } from "@/lib/types";

type Props = { message: ChatMessageType };

export function ChatMessage({ message }: Props) {
  return (
    <Card size="sm">
      <CardContent className="text-xs text-muted-foreground">
        ChatMessage {message.id}
      </CardContent>
    </Card>
  );
}
