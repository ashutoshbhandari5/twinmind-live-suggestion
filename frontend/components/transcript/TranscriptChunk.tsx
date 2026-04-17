import type { TranscriptChunk as TranscriptChunkType } from "@/lib/types";

const TIME_FORMAT = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

type Props = { chunk: TranscriptChunkType };

export function TranscriptChunk({ chunk }: Props) {
  return (
    <div className="flex flex-col gap-1 py-2">
      <span className="text-[10px] tracking-widest text-muted-foreground">
        {TIME_FORMAT.format(new Date(chunk.timestamp))}
      </span>
      <p className="text-sm leading-relaxed text-foreground">{chunk.text}</p>
    </div>
  );
}
