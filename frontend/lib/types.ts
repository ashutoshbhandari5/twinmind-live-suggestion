export type SuggestionType =
  | "question"
  | "talking_point"
  | "answer"
  | "fact_check"
  | "clarification";

export type TranscriptChunk = {
  id: string;
  text: string;
  timestamp: number;
};

export type Suggestion = {
  id: string;
  type: SuggestionType;
  preview: string;
  reasoning: string;
};

export type SuggestionBatch = {
  id: string;
  timestamp: number;
  suggestions: Suggestion[];
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  sourceSuggestion?: { type: SuggestionType; preview: string };
};

export type TranscribeResponse = {
  text: string;
  duration_ms: number;
};

export type SuggestionsResponse = {
  batch_id: string;
  timestamp: number;
  suggestions: Suggestion[];
};

export type ExportPayload = {
  transcript: TranscriptChunk[];
  suggestionBatches: SuggestionBatch[];
  chatMessages: ChatMessage[];
  sessionStartedAt: number | null;
};
