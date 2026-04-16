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
  suggestionContextWindowSeconds: number;
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
  suggestionContextWindowSeconds: 90,
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
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
