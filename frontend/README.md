# Frontend

Next.js 15 App Router app. Three columns: mic and transcript, live suggestions,
chat. All session state lives on the client in Zustand. The backend is a
stateless proxy; this app sends the user's Groq key as a header on every
request.

## Stack

- Next.js 15 (App Router) + React 19
- TypeScript strict
- Tailwind v4 + shadcn/ui + lucide-react
- Zustand 5 (with `persist` middleware) for session and settings stores
- `react-markdown` + `remark-gfm` for assistant-message rendering
- Sonner for toasts
- Vitest + React Testing Library + jsdom for tests

## Run locally

```bash
npm install
npm run dev           # http://localhost:3000
npm run typecheck
npm run lint
npm run test
npm run build         # production build
```

You also need the backend running at `http://localhost:8000`. See
[`../backend/README.md`](../backend/README.md).

## First-run checklist

1. Open `http://localhost:3000`.
2. Click Settings.
3. Paste your Groq API key. The field validates `gsk_` prefix plus at least 20
   alphanumeric chars. Empty is allowed, the app will prompt later.
4. Review the three prompts and defaults, press Apply.
5. Go home, press the mic. Speak for about 90 seconds to see one full
   suggestions batch.

## Project layout

```
frontend/
├── app/
│   ├── layout.tsx            root layout, dark theme, toast provider
│   ├── page.tsx              three-column home
│   ├── settings/
│   │   └── page.tsx          prompts, interval, context size, API key
│   └── globals.css
├── components/
│   ├── transcript/           MicButton, TranscriptFeed, TranscriptChunk
│   ├── suggestions/          SuggestionsPanel, SuggestionCard, BatchDivider,
│   │                         TypeBadge
│   ├── chat/                 ChatPanel, ChatMessage, ChatInput
│   ├── shared/               domain-agnostic bits (status pills, etc.)
│   └── ui/                   shadcn/ui primitives only (Button, Card, ...)
├── hooks/
│   ├── useRecorder.ts        module-level recorder state, survives remounts
│   ├── useAutoRefresh.ts     fires /suggestions when new chunks land
│   └── useChatStream.ts      streamed fetch reader + abort support
├── lib/
│   ├── api.ts                fetch wrappers for all four endpoints
│   ├── prompts.ts            the three editable prompt constants
│   ├── store.ts              Zustand session store (transcript, batches,
│   │                         messages, recorder status)
│   ├── settings-store.ts     Zustand settings store, persisted
│   ├── types.ts              shared TS types
│   ├── audio.ts              MediaRecorder mime detection + helpers
│   ├── export.ts             client-side JSON bundle builder
│   └── utils.ts              cn(), timestamp formatting
└── vitest.setup.ts           jsdom + RTL setup
```

## State model

Two Zustand stores, both persisted to `localStorage`:

- **Session store** (`lib/store.ts`): `transcript`, `suggestionBatches`,
  `chatMessages`, `isRecording`, `currentChunkStart`, plus `clearSession`.
  Persisted so a refresh keeps the session.
- **Settings store** (`lib/settings-store.ts`): three prompt strings, refresh
  interval seconds, suggestion context chunk count, Groq API key. Persisted.

The recorder itself holds its lifecycle in a **module-level singleton** in
`hooks/useRecorder.ts`. This keeps the `MediaRecorder`, the stream, the
pending rotation timeout, and the chunk start timestamp alive across React
remounts (e.g. navigating to Settings and back).

## Component rules

- **Base primitives come from shadcn/ui**. Never build a custom Button, Input,
  Textarea, Card, Dialog, ScrollArea, Badge, Skeleton, Label, Separator, or
  Tooltip.
- **Domain components** (MicButton, SuggestionCard, TypeBadge, TranscriptChunk,
  ChatMessage) are built from shadcn primitives plus Tailwind.
- **Icons** come from `lucide-react`. No other icon libraries.
- **Styling** uses Tailwind utility classes and `cn()` from `lib/utils.ts` for
  conditional combinations.
- **Dark mode only.** No theme toggle. Colors match
  [`../docs/prototype-notes.md`](../docs/prototype-notes.md).

## Environment variables

| Name | Required | Default | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_BACKEND_URL` | no | `http://localhost:8000` | Public URL of the FastAPI backend. Set this to the Railway URL in production. |

See `.env.example` for a template. `.env.local` is gitignored.

## Testing

```bash
npm run test          # headless, single run
npm run test:watch    # watch mode
```

Frontend tests cover hook behavior (`useRecorder`, `useAutoRefresh`,
`useChatStream`), the Zustand stores, the export helpers, the mic button, the
transcript panel, and the suggestions panel. Tests focus on user-facing
behavior, not implementation details.

## Code conventions

- TypeScript strict. No `any`. Shared types in `lib/types.ts`.
- Named exports only. Default exports are reserved for Next.js pages.
- Comments explain WHY, not WHAT.
- Errors on every network call. Toasts via Sonner. Never a silent failure.
- No em dashes. No marketing language in UI copy.

## Deployment

Vercel picks up the Next.js app automatically when pointed at this directory.
Set `NEXT_PUBLIC_BACKEND_URL` to the Railway backend URL. See
[`../README.md#deployment`](../README.md#deployment).
