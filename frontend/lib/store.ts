import { create } from "zustand";
import type {
  ChatMessage,
  SuggestionBatch,
  TranscriptChunk,
} from "./types";

type SessionState = {
  isRecording: boolean;
  recordingStartedAt: number | null;
  transcript: TranscriptChunk[];
  suggestionBatches: SuggestionBatch[];
  isLoadingSuggestions: boolean;
  lastRefreshAt: number | null;
  chatMessages: ChatMessage[];
  isStreamingChat: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  addTranscriptChunk: (chunk: TranscriptChunk) => void;
  addSuggestionBatch: (batch: SuggestionBatch) => void;
  setLoadingSuggestions: (loading: boolean) => void;
  addChatMessage: (message: ChatMessage) => void;
  appendChatToken: (messageId: string, token: string) => void;
  setStreamingChat: (streaming: boolean) => void;
  reset: () => void;
};

const initialState = {
  isRecording: false,
  recordingStartedAt: null,
  transcript: [],
  suggestionBatches: [],
  isLoadingSuggestions: false,
  lastRefreshAt: null,
  chatMessages: [],
  isStreamingChat: false,
} satisfies Partial<SessionState>;

export const useSessionStore = create<SessionState>((set) => ({
  ...initialState,
  startRecording: () =>
    set({ isRecording: true, recordingStartedAt: Date.now() }),
  stopRecording: () => set({ isRecording: false }),
  addTranscriptChunk: (chunk) =>
    set((state) => ({ transcript: [...state.transcript, chunk] })),
  addSuggestionBatch: (batch) =>
    set((state) => ({
      suggestionBatches: [batch, ...state.suggestionBatches],
      lastRefreshAt: batch.timestamp,
    })),
  setLoadingSuggestions: (loading) => set({ isLoadingSuggestions: loading }),
  addChatMessage: (message) =>
    set((state) => ({ chatMessages: [...state.chatMessages, message] })),
  appendChatToken: (messageId, token) =>
    set((state) => ({
      chatMessages: state.chatMessages.map((m) =>
        m.id === messageId ? { ...m, content: m.content + token } : m,
      ),
    })),
  setStreamingChat: (streaming) => set({ isStreamingChat: streaming }),
  reset: () => set({ ...initialState }),
}));
