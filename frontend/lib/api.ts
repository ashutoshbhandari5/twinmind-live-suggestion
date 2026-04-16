import type {
  ChatMessage,
  ExportPayload,
  SuggestionsResponse,
  TranscribeResponse,
  TranscriptChunk,
} from "./types";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

type HeaderArgs = { apiKey: string };

function authHeaders({ apiKey }: HeaderArgs): Record<string, string> {
  return { "x-groq-api-key": apiKey };
}

export async function transcribeAudio(args: {
  apiKey: string;
  audio: Blob;
}): Promise<TranscribeResponse> {
  const form = new FormData();
  form.append("file", args.audio, "chunk.webm");
  const res = await fetch(`${BACKEND_URL}/transcribe`, {
    method: "POST",
    headers: authHeaders(args),
    body: form,
  });
  if (!res.ok) throw new Error(`transcribe failed: ${res.status}`);
  return (await res.json()) as TranscribeResponse;
}

export async function fetchSuggestions(args: {
  apiKey: string;
  transcript: TranscriptChunk[];
  promptTemplate: string;
  contextWindowSeconds: number;
  sessionStartedAt: number | null;
}): Promise<SuggestionsResponse> {
  const res = await fetch(`${BACKEND_URL}/suggestions`, {
    method: "POST",
    headers: {
      ...authHeaders({ apiKey: args.apiKey }),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transcript: args.transcript,
      prompt_template: args.promptTemplate,
      context_window_seconds: args.contextWindowSeconds,
      session_started_at: args.sessionStartedAt,
    }),
  });
  if (!res.ok) throw new Error(`suggestions failed: ${res.status}`);
  return (await res.json()) as SuggestionsResponse;
}

export async function streamChat(args: {
  apiKey: string;
  transcript: TranscriptChunk[];
  messages: ChatMessage[];
  newMessage: string;
  promptTemplate: string;
  onToken: (token: string) => void;
}): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/chat`, {
    method: "POST",
    headers: {
      ...authHeaders({ apiKey: args.apiKey }),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transcript: args.transcript,
      messages: args.messages,
      new_message: args.newMessage,
      prompt_template: args.promptTemplate,
    }),
  });
  if (!res.ok || !res.body) throw new Error(`chat failed: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    args.onToken(decoder.decode(value, { stream: true }));
  }
}

export async function exportSession(
  payload: ExportPayload,
): Promise<{ json: string }> {
  const res = await fetch(`${BACKEND_URL}/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`export failed: ${res.status}`);
  return (await res.json()) as { json: string };
}
