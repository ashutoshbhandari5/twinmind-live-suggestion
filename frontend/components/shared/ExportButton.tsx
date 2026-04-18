"use client";

import { Button } from "@/components/ui/button";
import { downloadExport } from "@/lib/export";

export function ExportButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => downloadExport()}
    >
      Export
    </Button>
  );
}
