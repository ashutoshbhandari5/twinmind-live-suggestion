"use client";

import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  onRefresh: () => void | Promise<void>;
  disabled?: boolean;
};

export function ReloadButton({ onRefresh, disabled }: Props) {
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={() => {
        void onRefresh();
      }}
    >
      <RotateCw className="mr-2 size-3" />
      Reload suggestions
    </Button>
  );
}
