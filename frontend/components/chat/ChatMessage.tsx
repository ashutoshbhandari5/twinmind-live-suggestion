import type { ChatMessage as ChatMessageType } from "@/lib/types";

type Props = { message: ChatMessageType };

export function ChatMessage({ message }: Props) {
  return (
    <div className="rounded border border-dashed border-zinc-700 p-2 text-xs text-zinc-500">
      ChatMessage {message.id}
    </div>
  );
}
