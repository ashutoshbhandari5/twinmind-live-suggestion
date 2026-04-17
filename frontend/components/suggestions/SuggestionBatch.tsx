import type { MomentType, SuggestionBatch as Batch } from "@/lib/types";
import { SuggestionCard } from "./SuggestionCard";

const CLOCK = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

const MOMENT_LABELS: Record<MomentType, string> = {
  question_asked: "Question asked",
  claim_made: "Claim made",
  decision_point: "Decision point",
  topic_exploration: "Topic exploration",
  unfamiliar_term: "Unfamiliar term",
  idle: "Idle",
};

type Props = { batch: Batch; index: number; highlighted?: boolean };

export function SuggestionBatch({
  batch,
  index,
  highlighted = false,
}: Props) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 text-[10px] tracking-widest text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        <span>
          — BATCH {index} · {CLOCK.format(new Date(batch.timestamp))} ·{" "}
          {MOMENT_LABELS[batch.momentType]} —
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="flex flex-col gap-2">
        {batch.suggestions.map((s) => (
          <SuggestionCard key={s.id} suggestion={s} highlighted={highlighted} />
        ))}
      </div>
    </div>
  );
}
