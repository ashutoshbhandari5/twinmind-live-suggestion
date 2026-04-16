import type { Suggestion } from "@/lib/types";

type Props = { suggestion: Suggestion };

export function SuggestionCard({ suggestion }: Props) {
  return (
    <div className="rounded border border-dashed border-zinc-700 p-2 text-xs text-zinc-500">
      SuggestionCard {suggestion.id}
    </div>
  );
}
