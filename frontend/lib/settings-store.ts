import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  SUGGESTION_PROMPT,
  DETAILED_ANSWER_PROMPT,
  CHAT_PROMPT,
} from "./prompts";

type DetailedAnswerContextMode = "full" | "windowed";

type SettingsState = {
  groqApiKey: string;
  suggestionPrompt: string;
  detailedAnswerPrompt: string;
  chatPrompt: string;
  suggestionContextChunkCount: number;
  detailedAnswerContextMode: DetailedAnswerContextMode;
  refreshIntervalSeconds: number;
  updateApiKey: (key: string) => void;
  updatePrompt: (
    key: "suggestionPrompt" | "detailedAnswerPrompt" | "chatPrompt",
    value: string,
  ) => void;
  updateField: <K extends keyof SettingsState>(
    key: K,
    value: SettingsState[K],
  ) => void;
  resetToDefaults: () => void;
};

const defaults = {
  groqApiKey: "",
  suggestionPrompt: SUGGESTION_PROMPT,
  detailedAnswerPrompt: DETAILED_ANSWER_PROMPT,
  chatPrompt: CHAT_PROMPT,
  suggestionContextChunkCount: 3,
  detailedAnswerContextMode: "full" as DetailedAnswerContextMode,
  refreshIntervalSeconds: 30,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaults,
      updateApiKey: (key) => set({ groqApiKey: key }),
      updatePrompt: (key, value) => set({ [key]: value } as Partial<SettingsState>),
      updateField: (key, value) =>
        set({ [key]: value } as Partial<SettingsState>),
      resetToDefaults: () => set({ ...defaults }),
    }),
    {
      name: "twinmind-settings",
      // v1 ships the first real SUGGESTION_PROMPT. Pre-v1 installs had "" for
      // every prompt, which now fails backend validation. Migrate by filling
      // any empty prompt with the current default. User edits survive.
      version: 1,
      migrate: (persistedState) => {
        const s = (persistedState ?? {}) as Partial<SettingsState>;
        if (!s.suggestionPrompt) s.suggestionPrompt = SUGGESTION_PROMPT;
        if (!s.detailedAnswerPrompt)
          s.detailedAnswerPrompt = DETAILED_ANSWER_PROMPT;
        if (!s.chatPrompt) s.chatPrompt = CHAT_PROMPT;
        if (
          typeof s.suggestionContextChunkCount !== "number" ||
          s.suggestionContextChunkCount < 1
        ) {
          s.suggestionContextChunkCount = defaults.suggestionContextChunkCount;
        }
        return s;
      },
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
