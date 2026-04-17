import { Badge } from "@/components/ui/badge";
import type { SuggestionType } from "@/lib/types";

type Props = { type: SuggestionType };

export function TypeBadge({ type }: Props) {
  return (
    <Badge variant="outline" className="uppercase tracking-widest">
      {type}
    </Badge>
  );
}
