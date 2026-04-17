import { Card, CardContent } from "@/components/ui/card";
import type { TranscriptChunk as TranscriptChunkType } from "@/lib/types";

type Props = { chunk: TranscriptChunkType };

export function TranscriptChunk({ chunk }: Props) {
  return (
    <Card size="sm">
      <CardContent className="text-xs text-muted-foreground">
        TranscriptChunk {chunk.id}
      </CardContent>
    </Card>
  );
}
