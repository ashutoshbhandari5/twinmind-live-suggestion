import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function ChatInput() {
  return (
    <div className="flex items-center gap-2 border-t border-border p-3">
      <Input placeholder="Ask anything..." disabled />
      <Button disabled>Send</Button>
    </div>
  );
}
