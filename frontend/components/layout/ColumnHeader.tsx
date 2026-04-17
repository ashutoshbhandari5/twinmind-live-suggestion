import type { ReactNode } from "react";

type Props = {
  index: number;
  title: string;
  right?: ReactNode;
};

export function ColumnHeader({ index, title, right }: Props) {
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-3">
      <h2 className="text-xs font-medium tracking-widest text-muted-foreground">
        {index}. {title.toUpperCase()}
      </h2>
      <div className="text-[10px] tracking-widest text-muted-foreground">
        {right}
      </div>
    </div>
  );
}
