import { Card, CardContent } from "@/components/ui/card";
import type { Suggestion } from "@/lib/types";

type Props = { suggestion: Suggestion };

export function SuggestionCard({ suggestion }: Props) {
  return (
    <Card size="sm">
      <CardContent className="text-xs text-muted-foreground">
        SuggestionCard {suggestion.id}
      </CardContent>
    </Card>
  );
}
