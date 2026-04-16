import type { ReactNode } from "react";

type Props = {
  left: ReactNode;
  middle: ReactNode;
  right: ReactNode;
};

export function ThreeColumnLayout({ left, middle, right }: Props) {
  return (
    <div className="grid flex-1 grid-cols-3 divide-x divide-zinc-800">
      <section className="min-h-0">{left}</section>
      <section className="min-h-0">{middle}</section>
      <section className="min-h-0">{right}</section>
    </div>
  );
}
