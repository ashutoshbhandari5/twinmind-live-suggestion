import type { ReactNode } from "react";

type Props = { children: ReactNode };

export function HintCard({ children }: Props) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-400">
      {children}
    </div>
  );
}
