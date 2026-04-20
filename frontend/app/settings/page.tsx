"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
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
import {
  SUGGESTION_PROMPT,
  DETAILED_ANSWER_PROMPT,
  CHAT_PROMPT,
} from "@/lib/prompts";

// The draft mirrors editable fields as strings so the UI can accept
// in-progress input ("", "1", "12") without fighting the type system. We
// parse and validate at submit time.
type Draft = {
  groqApiKey: string;
  suggestionContextChunkCount: string;
  refreshIntervalSeconds: string;
  suggestionPrompt: string;
  detailedAnswerPrompt: string;
  chatPrompt: string;
};

type Errors = Partial<Record<keyof Draft, string>>;

function fieldId(key: keyof Draft): string {
  return `settings-field-${key}`;
}

const DEFAULT_DRAFT: Draft = {
  groqApiKey: "",
  suggestionContextChunkCount: "3",
  refreshIntervalSeconds: "30",
  suggestionPrompt: SUGGESTION_PROMPT,
  detailedAnswerPrompt: DETAILED_ANSWER_PROMPT,
  chatPrompt: CHAT_PROMPT,
};

type EditableStoreSlice = {
  groqApiKey: string;
  suggestionContextChunkCount: number;
  refreshIntervalSeconds: number;
  suggestionPrompt: string;
  detailedAnswerPrompt: string;
  chatPrompt: string;
};

function pickEditable(s: EditableStoreSlice): Draft {
  return {
    groqApiKey: s.groqApiKey,
    suggestionContextChunkCount: String(s.suggestionContextChunkCount),
    refreshIntervalSeconds: String(s.refreshIntervalSeconds),
    suggestionPrompt: s.suggestionPrompt,
    detailedAnswerPrompt: s.detailedAnswerPrompt,
    chatPrompt: s.chatPrompt,
  };
}

type Committed = {
  groqApiKey: string;
  suggestionContextChunkCount: number;
  refreshIntervalSeconds: number;
  suggestionPrompt: string;
  detailedAnswerPrompt: string;
  chatPrompt: string;
};

// Groq keys are gsk_ + 48 alphanumeric chars (52 total). We accept anything
// >= 20 chars after the prefix so a future format change does not break saves.
const GROQ_KEY_RE = /^gsk_[A-Za-z0-9]{20,}$/;

function validateGroqKey(key: string): string | undefined {
  if (key === "") return undefined; // empty is allowed — prompt fires at record time
  if (!key.startsWith("gsk_"))
    return 'Groq keys start with "gsk_". Check your key and try again.';
  if (!GROQ_KEY_RE.test(key))
    return "Key looks too short or contains invalid characters.";
  return undefined;
}

function validate(
  draft: Draft,
): { ok: true; values: Committed } | { ok: false; errors: Errors } {
  const errors: Errors = {};

  const keyError = validateGroqKey(draft.groqApiKey);
  if (keyError) errors.groqApiKey = keyError;

  const chunks = Number(draft.suggestionContextChunkCount);
  if (
    draft.suggestionContextChunkCount.trim() === "" ||
    !Number.isInteger(chunks) ||
    chunks < 1 ||
    chunks > 50
  ) {
    errors.suggestionContextChunkCount = "Whole number between 1 and 50.";
  }

  const interval = Number(draft.refreshIntervalSeconds);
  if (
    draft.refreshIntervalSeconds.trim() === "" ||
    !Number.isInteger(interval) ||
    interval < 10 ||
    interval > 30
  ) {
    errors.refreshIntervalSeconds = "Whole number between 10 and 30.";
  }

  for (const k of [
    "suggestionPrompt",
    "detailedAnswerPrompt",
    "chatPrompt",
  ] as const) {
    if (!draft[k].trim()) {
      errors[k] = "Prompt cannot be empty.";
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    values: {
      groqApiKey: draft.groqApiKey,
      suggestionContextChunkCount: chunks,
      refreshIntervalSeconds: interval,
      suggestionPrompt: draft.suggestionPrompt,
      detailedAnswerPrompt: draft.detailedAnswerPrompt,
      chatPrompt: draft.chatPrompt,
    },
  };
}

// Prompt keys that need to be force-opened when they have an error.
const PROMPT_KEYS = [
  "suggestionPrompt",
  "detailedAnswerPrompt",
  "chatPrompt",
] as const;
type PromptKey = (typeof PROMPT_KEYS)[number];

export default function SettingsPage() {
  const store = useSettingsStore();
  const [draft, setDraft] = useState<Draft>(() => pickEditable(store));
  const [errors, setErrors] = useState<Errors>({});
  // Prompts are collapsed by default; expand on demand.
  const [openPrompts, setOpenPrompts] = useState<Set<PromptKey>>(new Set());

  const isDirty = useMemo(() => {
    const current = pickEditable(store);
    return (Object.keys(current) as (keyof Draft)[]).some(
      (k) => current[k] !== draft[k],
    );
  }, [draft, store]);

  function update<K extends keyof Draft>(key: K, value: Draft[K]): void {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function togglePrompt(key: PromptKey): void {
    setOpenPrompts((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleSubmit(): void {
    const result = validate(draft);
    if (!result.ok) {
      setErrors(result.errors);
      // Force-open any prompt cards that have errors so the error is visible.
      const promptErrors = PROMPT_KEYS.filter((k) => result.errors[k]);
      if (promptErrors.length > 0) {
        setOpenPrompts((prev) => {
          const next = new Set(prev);
          promptErrors.forEach((k) => next.add(k));
          return next;
        });
      }
      scrollToFirstError(result.errors);
      const errorCount = Object.keys(result.errors).length;
      toast.error(
        errorCount === 1
          ? "Fix the highlighted field before saving."
          : `Fix ${errorCount} highlighted fields before saving.`,
      );
      return;
    }

    try {
      const v = result.values;
      store.updateApiKey(v.groqApiKey);
      store.updatePrompt("suggestionPrompt", v.suggestionPrompt);
      store.updatePrompt("detailedAnswerPrompt", v.detailedAnswerPrompt);
      store.updatePrompt("chatPrompt", v.chatPrompt);
      store.updateField(
        "suggestionContextChunkCount",
        v.suggestionContextChunkCount,
      );
      store.updateField("refreshIntervalSeconds", v.refreshIntervalSeconds);
      setErrors({});
      toast.success("Settings saved.");
    } catch {
      toast.error("Failed to save settings. Try again.");
    }
  }

  function handleReset(): void {
    setDraft(DEFAULT_DRAFT);
    setErrors({});
    toast("Reset to defaults. Click Apply changes to save.");
  }

  function scrollToFirstError(errs: Errors): void {
    // Visual order on the page. First errored field in this order wins.
    const order: (keyof Draft)[] = [
      "groqApiKey",
      "suggestionContextChunkCount",
      "refreshIntervalSeconds",
      "suggestionPrompt",
      "detailedAnswerPrompt",
      "chatPrompt",
    ];
    const first = order.find((k) => errs[k]);
    if (!first) return;
    const el = document.getElementById(fieldId(first));
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // Focus after the scroll kicks off so the browser doesn't snap the page
    // to the element's default position before the smooth scroll runs.
    window.setTimeout(() => {
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.focus({ preventScroll: true });
      }
    }, 300);
  }

  return (
    // pb-24 reserves space so content is never hidden behind the sticky bar.
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">Settings</h1>
        <Link
          href="/"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Back
        </Link>
      </div>

      <Card className={errors.groqApiKey ? "border-destructive/50" : undefined}>
        <CardHeader>
          <CardTitle>Groq API key</CardTitle>
          <CardDescription>
            Stored locally in your browser. Sent per-request in the
            x-groq-api-key header.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Label htmlFor={fieldId("groqApiKey")} className="sr-only">
            Groq API key
          </Label>
          <Input
            id={fieldId("groqApiKey")}
            type="password"
            value={draft.groqApiKey}
            onChange={(e) => update("groqApiKey", e.target.value)}
            placeholder="gsk_..."
            aria-invalid={errors.groqApiKey ? true : undefined}
          />
          {errors.groqApiKey ? (
            <p className="text-[10px] text-destructive">{errors.groqApiKey}</p>
          ) : (
            <p className="text-[10px] text-muted-foreground">
              Must start with <code className="font-mono">gsk_</code>. Leave
              blank to be prompted when you start recording.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Context windows</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <NumberField
            id={fieldId("suggestionContextChunkCount")}
            label="Suggestion window (chunks)"
            value={draft.suggestionContextChunkCount}
            onChange={(v) => update("suggestionContextChunkCount", v)}
            error={errors.suggestionContextChunkCount}
            hint="Whole number 1–50."
          />
          <NumberField
            id={fieldId("refreshIntervalSeconds")}
            label="Refresh interval (s)"
            value={draft.refreshIntervalSeconds}
            onChange={(v) => update("refreshIntervalSeconds", v)}
            error={errors.refreshIntervalSeconds}
            hint="Whole number 10–30."
          />
        </CardContent>
      </Card>

      {PROMPT_KEYS.map((key) => {
        const labels: Record<PromptKey, string> = {
          suggestionPrompt: "Suggestion prompt",
          detailedAnswerPrompt: "Detailed answer prompt",
          chatPrompt: "Chat prompt",
        };
        return (
          <PromptCard
            key={key}
            id={fieldId(key)}
            label={labels[key]}
            value={draft[key]}
            onChange={(v) => update(key, v)}
            error={errors[key]}
            open={openPrompts.has(key)}
            onToggle={() => togglePrompt(key)}
          />
        );
      })}

      {/* Sticky action bar — always reachable without scrolling */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-6 py-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="cursor-pointer"
          >
            Reset to defaults
          </Button>
          <div className="flex items-center gap-3">
            {isDirty && (
              <span className="text-[10px] tracking-wide text-amber-400">
                Unsaved changes
              </span>
            )}
            <Button
              onClick={handleSubmit}
              disabled={!isDirty}
              className="cursor-pointer"
            >
              Apply changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
      />
      {error ? (
        <p className="text-[10px] text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-[10px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function PromptCard({
  id,
  label,
  value,
  onChange,
  error,
  open,
  onToggle,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <Card className={error ? "border-destructive/50" : undefined}>
      {/* Clickable header toggles the prompt body */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center justify-between px-6 py-4 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold">{label}</span>
        <div className="flex items-center gap-2">
          {error && (
            <span className="text-[10px] text-destructive">{error}</span>
          )}
          {open ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </div>
      </button>
      {open && (
        <CardContent className="flex flex-col gap-2 pt-0">
          <Textarea
            id={id}
            rows={10}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="font-mono text-xs"
            aria-invalid={error ? true : undefined}
          />
          {error && (
            <p className="text-[10px] text-destructive">{error}</p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
