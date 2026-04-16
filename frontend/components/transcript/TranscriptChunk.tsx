import type { TranscriptChunk as TranscriptChunkType } from "@/lib/types";

type Props = { chunk: TranscriptChunkType };

export function TranscriptChunk({ chunk }: Props) {
  return (
    <div className="rounded border border-dashed border-zinc-700 p-2 text-xs text-zinc-500">
      TranscriptChunk {chunk.id}
    </div>
  );
}
