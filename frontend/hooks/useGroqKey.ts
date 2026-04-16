import { useSettingsStore } from "@/lib/settings-store";

export function useGroqKey(): string {
  return useSettingsStore((state) => state.groqApiKey);
}
