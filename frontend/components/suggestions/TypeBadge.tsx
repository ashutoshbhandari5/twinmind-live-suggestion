import type { SuggestionType } from "@/lib/types";

type Props = { type: SuggestionType };

export function TypeBadge({ type }: Props) {
  return (
    <span className="rounded border border-dashed border-zinc-700 px-2 py-0.5 text-[10px] uppercase tracking-widest text-zinc-500">
      {type}
    </span>
  );
}
