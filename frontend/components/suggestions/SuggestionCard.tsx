"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/lib/store";
import type { Suggestion, SuggestionType } from "@/lib/types";
import { TypeBadge } from "./TypeBadge";

// shadcn Card uses a ring (not a border) for its outline. Override the ring
// color per type for the latest batch so the newest cards visually pop;
// older batches get dimmed for contrast during a live meeting.
const RINGS: Record<SuggestionType, string> = {
  question: "ring-2 ring-blue-500/60",
  talking_point: "ring-2 ring-purple-500/60",
  answer: "ring-2 ring-green-500/60",
  fact_check: "ring-2 ring-amber-500/60",
  clarification: "ring-2 ring-cyan-500/60",
};

type Props = { suggestion: Suggestion; highlighted?: boolean };

export function SuggestionCard({ suggestion, highlighted = false }: Props) {
  function handleClick() {
    useSessionStore.getState().addChatMessage({
      id: crypto.randomUUID(),
      role: "user",
      content: suggestion.preview,
      timestamp: Date.now(),
      sourceSuggestion: {
        type: suggestion.type,
        preview: suggestion.preview,
        reasoning: suggestion.reasoning,
      },
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "block w-full text-left transition-opacity",
        !highlighted && "opacity-60 hover:opacity-100",
      )}
      aria-label={`Ask chat about: ${suggestion.preview}`}
    >
      <Card
        className={cn(
          "cursor-pointer transition-colors hover:bg-muted/40",
          highlighted && RINGS[suggestion.type],
        )}
      >
        <CardContent className="flex flex-col gap-2 p-3">
          <TypeBadge type={suggestion.type} />
          <p className="text-sm leading-relaxed text-foreground">
            {suggestion.preview}
          </p>
        </CardContent>
      </Card>
    </button>
  );
}
