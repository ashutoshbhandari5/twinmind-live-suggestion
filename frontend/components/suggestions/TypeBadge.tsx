import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SuggestionType } from "@/lib/types";

const COLORS: Record<SuggestionType, string> = {
  question: "border-blue-500/40 text-blue-300 bg-blue-500/10",
  talking_point: "border-purple-500/40 text-purple-300 bg-purple-500/10",
  answer: "border-green-500/40 text-green-300 bg-green-500/10",
  fact_check: "border-amber-500/40 text-amber-300 bg-amber-500/10",
  clarification: "border-cyan-500/40 text-cyan-300 bg-cyan-500/10",
};

const LABELS: Record<SuggestionType, string> = {
  question: "QUESTION",
  talking_point: "TALKING POINT",
  answer: "ANSWER",
  fact_check: "FACT-CHECK",
  clarification: "CLARIFICATION",
};

type Props = { type: SuggestionType };

export function TypeBadge({ type }: Props) {
  return (
    <Badge
      variant="outline"
      className={cn("tracking-widest text-[10px]", COLORS[type])}
    >
      {LABELS[type]}
    </Badge>
  );
}
