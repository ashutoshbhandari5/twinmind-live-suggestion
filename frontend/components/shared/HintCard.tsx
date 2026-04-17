import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

type Props = { children: ReactNode };

export function HintCard({ children }: Props) {
  return (
    <Card size="sm">
      <CardContent className="text-xs text-muted-foreground">
        {children}
      </CardContent>
    </Card>
  );
}
