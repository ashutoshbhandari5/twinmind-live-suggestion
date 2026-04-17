import { Card, CardContent } from "@/components/ui/card";
import type { SuggestionBatch as Batch } from "@/lib/types";

type Props = { batch: Batch; index: number };

export function SuggestionBatch({ batch, index }: Props) {
  return (
    <Card size="sm">
      <CardContent className="text-xs text-muted-foreground">
        SuggestionBatch #{index} · {batch.id}
      </CardContent>
    </Card>
  );
}
