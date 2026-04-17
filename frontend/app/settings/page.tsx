"use client";

import Link from "next/link";
import { useSettingsStore } from "@/lib/settings-store";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function SettingsPage() {
  const state = useSettingsStore();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">Settings</h1>
        <Link
          href="/"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Back
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Groq API key</CardTitle>
          <CardDescription>
            Stored locally in your browser. Sent per-request in the
            x-groq-api-key header.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Label htmlFor="groq-key" className="sr-only">
            Groq API key
          </Label>
          <Input
            id="groq-key"
            type="password"
            value={state.groqApiKey}
            onChange={(e) => state.updateApiKey(e.target.value)}
            placeholder="gsk_..."
          />
        </CardContent>
      </Card>

      <PromptCard
        label="Suggestion prompt"
        value={state.suggestionPrompt}
        onChange={(v) => state.updatePrompt("suggestionPrompt", v)}
      />
      <PromptCard
        label="Detailed answer prompt"
        value={state.detailedAnswerPrompt}
        onChange={(v) => state.updatePrompt("detailedAnswerPrompt", v)}
      />
      <PromptCard
        label="Chat prompt"
        value={state.chatPrompt}
        onChange={(v) => state.updatePrompt("chatPrompt", v)}
      />

      <Card>
        <CardHeader>
          <CardTitle>Context windows</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-2">
            <Label>Suggestion window (s)</Label>
            <Input
              type="number"
              value={state.suggestionContextWindowSeconds}
              onChange={(e) =>
                state.updateField(
                  "suggestionContextWindowSeconds",
                  Number(e.target.value),
                )
              }
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Detailed answer context</Label>
            <select
              value={state.detailedAnswerContextMode}
              onChange={(e) =>
                state.updateField(
                  "detailedAnswerContextMode",
                  e.target.value as "full" | "windowed",
                )
              }
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <option value="full">Full transcript</option>
              <option value="windowed">Windowed</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Refresh interval (s)</Label>
            <Input
              type="number"
              value={state.refreshIntervalSeconds}
              onChange={(e) =>
                state.updateField(
                  "refreshIntervalSeconds",
                  Number(e.target.value),
                )
              }
            />
          </div>
        </CardContent>
      </Card>

      <div>
        <Button variant="outline" size="sm" onClick={state.resetToDefaults}>
          Reset to defaults
        </Button>
      </div>
    </div>
  );
}

function PromptCard({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <Textarea
          rows={6}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-xs"
        />
      </CardContent>
    </Card>
  );
}
