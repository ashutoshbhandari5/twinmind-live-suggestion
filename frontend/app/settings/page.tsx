"use client";

import Link from "next/link";
import { useSettingsStore } from "@/lib/settings-store";

export default function SettingsPage() {
  const state = useSettingsStore();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">Settings</h1>
        <Link href="/" className="text-xs text-zinc-400 hover:text-zinc-100">
          Back
        </Link>
      </div>

      <Field label="Groq API key">
        <input
          type="password"
          value={state.groqApiKey}
          onChange={(e) => state.updateApiKey(e.target.value)}
          placeholder="gsk_..."
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </Field>

      <Field label="Suggestion prompt">
        <textarea
          rows={6}
          value={state.suggestionPrompt}
          onChange={(e) => state.updatePrompt("suggestionPrompt", e.target.value)}
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </Field>

      <Field label="Detailed answer prompt">
        <textarea
          rows={6}
          value={state.detailedAnswerPrompt}
          onChange={(e) =>
            state.updatePrompt("detailedAnswerPrompt", e.target.value)
          }
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </Field>

      <Field label="Chat prompt">
        <textarea
          rows={6}
          value={state.chatPrompt}
          onChange={(e) => state.updatePrompt("chatPrompt", e.target.value)}
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Context window (seconds)">
          <input
            type="number"
            value={state.suggestionContextWindowSeconds}
            onChange={(e) =>
              state.updateField(
                "suggestionContextWindowSeconds",
                Number(e.target.value),
              )
            }
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </Field>
        <Field label="Detailed answer context">
          <select
            value={state.detailedAnswerContextMode}
            onChange={(e) =>
              state.updateField(
                "detailedAnswerContextMode",
                e.target.value as "full" | "windowed",
              )
            }
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-500"
          >
            <option value="full">Full transcript</option>
            <option value="windowed">Windowed</option>
          </select>
        </Field>
        <Field label="Refresh interval (seconds)">
          <input
            type="number"
            value={state.refreshIntervalSeconds}
            onChange={(e) =>
              state.updateField(
                "refreshIntervalSeconds",
                Number(e.target.value),
              )
            }
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </Field>
      </div>

      <div>
        <button
          type="button"
          onClick={state.resetToDefaults}
          className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-500"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs tracking-widest text-zinc-500">
        {label.toUpperCase()}
      </span>
      {children}
    </label>
  );
}
