# Architecture

## Data flow

```
Browser mic
  → MediaRecorder 30s timeslice chunks
  → POST /transcribe (multipart audio, x-groq-api-key header)
  → Groq Whisper Large V3
  → text appended to Zustand store

Every 30s OR manual refresh
  → POST /suggestions (recent transcript, prompt template, context window)
  → Groq GPT-OSS 120B
  → 3 suggestions appended as new batch at top

Suggestion click OR typed message
  → POST /chat (SSE stream, transcript + messages + new message)
  → Groq GPT-OSS 120B streaming
  → SSE to client
  → ASSISTANT block populates token-by-token
```

## State shape

Session store (Zustand, in-memory, reset on reload):

```typescript
type SessionState = {
  isRecording: boolean;
  recordingStartedAt: number | null;
  transcript: TranscriptChunk[];
  suggestionBatches: SuggestionBatch[]; // newest first
  isLoadingSuggestions: boolean;
  lastRefreshAt: number | null;
  chatMessages: ChatMessage[];
  isStreamingChat: boolean;
};

type TranscriptChunk = {
  id: string;
  text: string;
  timestamp: number;
};

type SuggestionBatch = {
  id: string;
  timestamp: number;
  suggestions: Suggestion[];
};

type Suggestion = {
  id: string;
  type:
    | "question"
    | "talking_point"
    | "answer"
    | "fact_check"
    | "clarification";
  preview: string;
  reasoning: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  sourceSuggestion?: { type: Suggestion["type"]; preview: string };
};
```

Settings store (Zustand with localStorage persist):

```typescript
type SettingsState = {
  groqApiKey: string;
  suggestionPrompt: string;
  detailedAnswerPrompt: string;
  chatPrompt: string;
  suggestionContextWindowSeconds: number; // default 90
  detailedAnswerContextMode: "full" | "windowed";
  refreshIntervalSeconds: number; // default 30
};
```

## Frontend structure

```
/app
  /page.tsx              three-column layout
  /settings/page.tsx     API key + prompts editor
  /layout.tsx
  /globals.css
/components
  /layout/ThreeColumnLayout.tsx, ColumnHeader.tsx
  /transcript/TranscriptPanel.tsx, MicButton.tsx, TranscriptFeed.tsx, TranscriptChunk.tsx
  /suggestions/SuggestionsPanel.tsx, ReloadButton.tsx, SuggestionBatch.tsx, SuggestionCard.tsx, TypeBadge.tsx
  /chat/ChatPanel.tsx, ChatMessage.tsx, ChatInput.tsx
  /shared/HintCard.tsx, ExportButton.tsx
/lib
  api.ts, store.ts, settings-store.ts, prompts.ts, types.ts, audio.ts
/hooks
  useRecorder.ts, useAutoRefresh.ts, useGroqKey.ts
```

## Backend structure

```
/app
  main.py
  /routes
    transcribe.py, suggestions.py, chat.py, export.py
  /services
    groq_client.py, prompt_builder.py
  /models
    schemas.py
  config.py
requirements.txt
Dockerfile
```

## Endpoint contracts

`POST /transcribe`

- Headers: `x-groq-api-key`
- Body: multipart audio
- Returns: `{ text: str, duration_ms: int }`
- Filter Whisper hallucinations: "Thank you.", "Thanks for watching.", empty strings

`POST /suggestions`

- Headers: `x-groq-api-key`
- Body: `{ transcript, prompt_template, context_window_seconds, session_started_at }`
- Returns: `{ batch_id, timestamp, suggestions: [...] }`
- Validate JSON from model, retry once on malformed

`POST /chat`

- Headers: `x-groq-api-key`
- Body: `{ transcript, messages, new_message, prompt_template }`
- Returns: SSE stream
- Use FastAPI StreamingResponse

`POST /export`

- Body: full session state from client
- Returns: formatted JSON

## Audio chunking strategy

MediaRecorder with timeslice creates a gotcha: only the first chunk has a valid WebM header, subsequent chunks are not independently decodable.

Solution: restart MediaRecorder every 30s. The ~50ms gap is imperceptible in natural conversation and Whisper handles it fine.

## Latency targets

- Reload to first suggestions visible: under 5s (fire first call at 20s into recording, not 30s)
- Chat click to first token: under 2s (stream end-to-end)
- Transcript chunk to rendered: under 3s after chunk closes

Tactics:

- SSE streaming for chat
- Do not block suggestions on latest transcribe
- Keep prompts tight, every 1k tokens of context costs real time

## Backend is stateless

- No database
- No session storage
- API key per-request header, never stored, never logged
- CORS: localhost:3000 dev, Vercel URL prod
