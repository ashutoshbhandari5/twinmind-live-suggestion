import { create } from "zustand";
import type {
  ChatMessage,
  SuggestionBatch,
  TranscriptChunk,
} from "./types";

type MicPermission = "unknown" | "granted" | "denied";
type RecorderError = "none" | "auto-stopped";
type SuggestionError = "none" | "failing" | "key-invalid";
type ChatError = "none" | "interrupted";

type SessionState = {
  isRecording: boolean;
  recordingStartedAt: number | null;
  transcript: TranscriptChunk[];
  suggestionBatches: SuggestionBatch[];
  isLoadingSuggestions: boolean;
  lastRefreshAt: number | null;
  chatMessages: ChatMessage[];
  isStreamingChat: boolean;
  micPermission: MicPermission;
  recorderError: RecorderError;
  suggestionError: SuggestionError;
  chatError: ChatError;
  startRecording: () => void;
  stopRecording: () => void;
  addTranscriptChunk: (chunk: TranscriptChunk) => void;
  addSuggestionBatch: (batch: SuggestionBatch) => void;
  setLoadingSuggestions: (loading: boolean) => void;
  addChatMessage: (message: ChatMessage) => void;
  appendChatToken: (messageId: string, token: string) => void;
  setStreamingChat: (streaming: boolean) => void;
  setMicPermission: (status: MicPermission) => void;
  setRecorderError: (error: RecorderError) => void;
  setSuggestionError: (error: SuggestionError) => void;
  setChatError: (error: ChatError) => void;
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
  micPermission: "unknown" as MicPermission,
  recorderError: "none" as RecorderError,
  suggestionError: "none" as SuggestionError,
  chatError: "none" as ChatError,
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
  setMicPermission: (status) => set({ micPermission: status }),
  setRecorderError: (error) => set({ recorderError: error }),
  setSuggestionError: (error) => set({ suggestionError: error }),
  setChatError: (error) => set({ chatError: error }),
  reset: () => set({ ...initialState }),
}));
