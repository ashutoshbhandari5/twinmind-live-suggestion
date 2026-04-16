import type { SuggestionBatch as Batch } from "@/lib/types";

type Props = { batch: Batch; index: number };

export function SuggestionBatch({ batch, index }: Props) {
  return (
    <div className="rounded border border-dashed border-zinc-700 p-2 text-xs text-zinc-500">
      SuggestionBatch #{index} · {batch.id}
    </div>
  );
}
