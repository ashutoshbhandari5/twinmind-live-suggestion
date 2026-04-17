import type { ReactNode } from "react";

type Props = {
  left: ReactNode;
  middle: ReactNode;
  right: ReactNode;
  separator: ReactNode;
};

export function ThreeColumnLayout({ left, middle, right, separator }: Props) {
  return (
    <div className="flex flex-1 min-h-0">
      <section className="flex-1 min-w-0">{left}</section>
      {separator}
      <section className="flex-1 min-w-0">{middle}</section>
      {separator}
      <section className="flex-1 min-w-0">{right}</section>
    </div>
  );
}
