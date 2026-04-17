export type SuggestionType =
  | "question"
  | "talking_point"
  | "answer"
  | "fact_check"
  | "clarification";

export type MomentType =
  | "question_asked"
  | "claim_made"
  | "decision_point"
  | "topic_exploration"
  | "unfamiliar_term"
  | "idle";

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
  momentType: MomentType;
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

// Response from POST /suggestions. Field names stay snake_case to match the
// backend; the api.ts translator converts to the camelCase SuggestionBatch.
export type SuggestionsResponse = {
  batch_id: string;
  timestamp: number;
  moment_type: MomentType;
  suggestions: Suggestion[];
};

export type ExportPayload = {
  transcript: TranscriptChunk[];
  suggestionBatches: SuggestionBatch[];
  chatMessages: ChatMessage[];
  sessionStartedAt: number | null;
};
