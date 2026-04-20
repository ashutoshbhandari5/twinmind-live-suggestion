<div align="center">

# TwinMind Live Suggestions

A browser app that listens to a live conversation, produces a running transcript,
and surfaces three useful suggestions every 30 seconds. A chat column on the right
expands any suggestion into a detailed streamed answer.

Built as a take-home for TwinMind (AI meeting copilot, Menlo Park). Role: full
stack / prompt engineer. Prompt quality is evaluated first, engineering second.

<br />

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009485?logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.11-3776ab?logo=python&logoColor=white)
![Groq](https://img.shields.io/badge/Groq-Whisper%20%2B%20GPT--OSS-f55036)
![License](https://img.shields.io/badge/license-MIT-green)

</div>

---

## Table of contents

- [Live demo](#live-demo)
- [What it does](#what-it-does)
- [Screenshots](#screenshots)
- [Quick start](#quick-start)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [API reference](#api-reference)
- [Prompt strategy](#prompt-strategy)
- [Tradeoffs and decisions](#tradeoffs-and-decisions)
- [Testing](#testing)
- [Deployment](#deployment)
- [What I would do with more time](#what-i-would-do-with-more-time)
- [Documentation map](#documentation-map)
- [License](#license)

---

## Live demo

| Surface | URL |
| --- | --- |
| App (Vercel) | _TBD_ |
| API (Railway) | _TBD_ |
| Health check | `GET /health` |

The backend holds no API key. Paste your own Groq key into the in-app Settings
page. The key is sent per-request in the `x-groq-api-key` header and never
persisted, logged, or echoed.

## What it does

Three-column workspace:

1. **Mic and transcript** on the left. Start the mic, speak, and transcribed
   text streams in as 30 second chunks.
2. **Live suggestions** in the middle. Every 30 seconds the model classifies the
   conversational moment (question asked, claim made, decision point, topic
   exploration, unfamiliar term, idle) and returns three suggestions tailored to
   that moment. Each preview delivers value unclicked.
3. **Chat** on the right. Click any suggestion to expand it into a detailed
   streamed answer. Or type your own question. Answers are rendered as Markdown.

Settings expose every tunable knob: the three prompts, the refresh interval, the
context window, and the Groq API key.

## Screenshots

Add screenshots or a short screen capture here before sharing the repo.

```
docs/media/
  hero.png           three-column view during a session
  settings.png       settings page with prompt editor open
  chat.gif           streamed answer for a suggestion click
```

## Quick start

**Prerequisites**

- Node 20 or newer
- Python 3.11
- A [Groq API key](https://console.groq.com/keys) (free tier is enough)

**Run the backend**

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API starts on `http://localhost:8000`. Verify with
`curl http://localhost:8000/health`.

**Run the frontend**

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. On first load, visit Settings, paste your Groq
key, and press Apply. Return to the home page and press the mic button.

**Optional: run all tests**

```bash
# frontend
cd frontend && npm run test

# backend
cd backend && source .venv/bin/activate && pytest
```

## Architecture

```
        Browser (Next.js 15, client-only session state in Zustand)
        +----------------------------------------------------------+
        |  MicButton  ->  MediaRecorder  ->  30s audio chunks       |
        |                                                          |
        |                    POST /transcribe  (multipart, 1 key)  |
        |                    POST /suggestions (JSON,    1 key)    |
        |                    POST /chat        (JSON,    1 key)    |
        |                    POST /export      (JSON)              |
        +-----------------------------|----------------------------+
                                      | x-groq-api-key per request
                                      v
        +----------------------------------------------------------+
        |                    FastAPI (stateless)                   |
        |     no DB, no cache, no session, no logging of the key   |
        +-----------------------------|----------------------------+
                                      | forwards with user's key
                                      v
        +----------------------------------------------------------+
        |      Groq API                                            |
        |      whisper-large-v3          (transcription)           |
        |      openai/gpt-oss-120b       (suggestions, chat)       |
        +----------------------------------------------------------+
```

**Key design choices**

- Backend is a thin stateless proxy. All session state lives in Zustand on the
  client. Refresh keeps the session across routes via `zustand/middleware`.
- The Groq key never leaves the client except as an `x-groq-api-key` header on
  outbound requests. It is not stored server-side and not logged.
- Chat responses stream as raw chunked `text/plain`. Errors that happen before
  the first token map to a proper HTTP status. Errors mid-stream close the body
  and the client renders a `Connection interrupted` pill.
- Models are fixed: `whisper-large-v3` for audio, `openai/gpt-oss-120b` for
  text. Temperatures are hardcoded (0.3 suggestions, 0.5 chat) so prompt edits
  are the only tuning surface exposed to the user.

Full detail in [`docs/architecture.md`](./docs/architecture.md).

## Project structure

```
twinmind-live-suggestions/
├── README.md                   this file
├── CLAUDE.md                   internal engineering rulebook
├── WORKFLOW.md                 6-phase feature workflow
├── SECURITY.md                 how the API key is handled
├── CONTRIBUTING.md             how to propose changes
├── LICENSE                     MIT
├── render.yaml                 Render Blueprint (Docker, /health probe)
├── .github/
│   ├── workflows/ci.yml        lint, typecheck, tests on push
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── ISSUE_TEMPLATE/
├── backend/
│   ├── app/
│   │   ├── main.py             FastAPI app and CORS
│   │   ├── config.py           model ids, timeouts, hallucination filter
│   │   ├── routes/             transcribe, suggestions, chat, export
│   │   ├── services/           Groq client, prompt builder
│   │   └── models/schemas.py   Pydantic request and response shapes
│   ├── tests/                  pytest suite
│   ├── Dockerfile              container image, pins Python 3.11
│   ├── Procfile                Heroku-style start command
│   ├── railway.toml            Railway deploy config
│   ├── .python-version         pins Python for non-Docker runtimes
│   └── requirements.txt
└── frontend/
    ├── app/                    Next.js App Router (home + settings)
    ├── components/             domain + shadcn/ui
    │   ├── transcript/
    │   ├── suggestions/
    │   ├── chat/
    │   ├── shared/
    │   └── ui/                 shadcn primitives
    ├── hooks/                  useRecorder, useAutoRefresh, useChatStream
    ├── lib/                    api, prompts, stores, types
    └── package.json
```

## API reference

All endpoints except `/health` and `/export` require the `x-groq-api-key`
header. Responses use standard HTTP status codes: 400 for bad input, 401 when
the key is missing or Groq rejects it, 413 for oversized payloads, 429 when
rate limited, 502 for upstream failures, 504 on timeout.

### `GET /health`

Returns `{ "status": "ok" }`. Used by Railway health checks.

### `POST /transcribe`

Multipart upload of a single audio chunk. Expects `audio/webm` or similar.

| Field | Type | Notes |
| --- | --- | --- |
| `file` | file | The audio chunk, typically a 30 second webm. |
| `duration_ms` | int | Echoed back to the client as ground truth. |

Response:

```json
{ "text": "string", "duration_ms": 30000 }
```

Empty strings are returned for Whisper hallucinations (`thank you.`,
`thanks for watching.`, `you`, etc.) matched via a full-text lowercase compare.

### `POST /suggestions`

```json
{
  "transcript": [{ "id": "c1", "text": "...", "timestamp": 1729200000000 }],
  "prompt_template": "<SYSTEM prompt from Settings>",
  "context_chunk_count": 3,
  "session_duration_ms": 90000,
  "previous_suggestions": [{ "type": "question", "preview": "..." }]
}
```

Response:

```json
{
  "batch_id": "b_12345678",
  "timestamp": 1729200030000,
  "moment_type": "question_asked",
  "suggestions": [
    { "id": "s_abcd1234", "type": "question", "preview": "...", "reasoning": "..." }
  ]
}
```

The model is instructed to return strict JSON. A malformed response triggers
one retry with a corrective postamble. A second malformed response returns 502.

### `POST /chat`

Streamed response. The first upstream error maps to an HTTP status. Errors
after the first token close the stream silently.

```json
{
  "transcript": [...],
  "messages": [{ "id": "m1", "role": "user", "content": "...", "timestamp": 1729200000000 }],
  "new_message": "explain that last suggestion",
  "source_suggestion": { "type": "question", "preview": "...", "reasoning": "..." },
  "prompt_template": "<SYSTEM prompt from Settings>"
}
```

`source_suggestion` is optional. Used when the user clicked a suggestion card
instead of typing.

### `POST /export`

Returns the session bundle as a JSON string. The client usually exports from a
local Zustand dump, so this endpoint exists mostly as a parity check.

## Prompt strategy

Three editable prompts live in
[`frontend/lib/prompts.ts`](./frontend/lib/prompts.ts). Each is exported as a
constant and overridable at runtime via Settings.

- `SUGGESTION_PROMPT` runs every 30 seconds when a new transcript chunk lands.
  Output is strict JSON. One retry on malformed, then 502.
- `DETAILED_ANSWER_PROMPT` runs when a suggestion card is clicked. Output is
  Markdown streamed token by token.
- `CHAT_PROMPT` runs when the user types a question directly. Output is
  Markdown streamed token by token.

### SYSTEM vs USER split

Every prompt follows the same pattern. The user-editable string is the SYSTEM
message. The USER message is assembled by the backend with live context. The
user cannot break templating by editing the wrong half.

- Suggestions USER turn: session duration, last N transcript chunks (default 3,
  Settings-tunable), previous batch for dedup, and an explicit instruction to
  emit JSON only.
- Chat USER turn: full transcript in the SYSTEM message, full prior chat
  history as real chat-completion turns, and a final synthesized turn. For a
  typed question the final turn is the user's raw text. For a suggestion click
  the final turn is
  `Click-through: [type] preview / Internal reasoning: ... / Explain in depth.`

### Classification before generation

The suggestions prompt forces the model to name the conversational moment
before it picks suggestion types. Six canonical values:

`question_asked`, `claim_made`, `decision_point`, `topic_exploration`,
`unfamiliar_term`, `idle`.

The classification is returned in the response and rendered on the batch
divider (`— BATCH 3 · 01:08:16 PM · Question asked —`) so reviewers can see the
model committed to a moment before choosing its suggestion types.

### Preview quality bar

The prompt hardcodes good-vs-bad examples. `You could ask about their revenue`
is rejected. `Their Q3 revenue grew 34% YoY to $2.1B per last earnings call` is
the target. Both chat prompts include anti-boilerplate rules
(`Do not start with "I'd be happy to"`, `Do not re-quote the user's question`).

### Batch dedup

Each suggestions request ships the previous batch previews back to the model
with an explicit "avoid repeating" instruction. The prompt tells the model to
advance the conversation rather than loop.

### Temperature

Hardcoded at 0.3 for suggestions (grounding) and 0.5 for chat (fluency). Not
exposed in Settings to keep demo output consistent across runs. Prompt edits
are the tuning surface.

### Context windowing

- **Suggestions:** last N transcript chunks (chunk-based, default 3).
  Chunk-based beats time-based because manual refresh can flush sub-30s chunks
  and we want a consistent context size regardless.
- **Chat:** full transcript plus full prior chat history on every request.
  Rolling summary for very long sessions is a deferred improvement.

Full text in [`docs/prompt-strategy.md`](./docs/prompt-strategy.md).

## Tradeoffs and decisions

Deliberate choices worth calling out. Per-feature detail under
[`docs/features/`](./docs/features/).

- **30s transcript chunks, one bubble per chunk.** Matches the spec. Shorter
  chunks multiply Groq spend for marginal UX gain. No sentence-splitting in the
  UI.
- **Chunk-based suggestion context, not seconds.** Manual refresh flushes
  mid-chunk, so time-based windowing produces uneven context sizes. Chunks are
  stable.
- **Strict JSON with one retry, then 502.** Hides a malformed-output bug once;
  surfaces it after two. Generous retries would let a broken prompt limp along.
- **Raw chunked text for chat streaming, not SSE.** Simpler wire. The
  `Connection interrupted` pill covers the fact that we cannot distinguish
  `done` from `error mid-stream` on raw chunked HTTP.
- **Markdown rendering only on assistant messages.** User messages are verbatim
  plain text so the model's output cannot echo-inject HTML back into the DOM.
  Assistant Markdown runs through `react-markdown` with `skipHtml`, dropped
  images, and forced `target="_blank" rel="noopener noreferrer"` on links.
- **Client-side blob download for export.** The browser already holds every
  byte of the session in Zustand. A network hop for the server to echo the same
  bytes adds latency for zero value.
- **Backend is stateless.** No DB, no session storage, no key persistence.
  The Groq key is sent per request in `x-groq-api-key` and never logged. This
  is a take-home constraint; a real service would look different.
- **Hardcoded temperatures.** One more knob is one more thing to demo wrong.
  The two prompts and their per-type context windows are the right tuning
  surface.
- **`moment_type` surfaced on the batch divider.** Visible signal that the
  model committed to a classification before generating.
- **Newest-batch highlighting via colored ring + older-batch opacity dim.** Eye
  lands on the fresh batch in under a second during a live conversation.
- **6-phase feature workflow with gates at doc review, plan review, and manual
  verification.** See [`WORKFLOW.md`](./WORKFLOW.md). Overkill for a take-home,
  but it produced the per-feature docs under `docs/features/`.

## Testing

Both stacks ship with a test suite. Tests cover happy path, validation
failures, boundary conditions, and error paths per
[`CLAUDE.md`](./CLAUDE.md#testing-standards).

| Stack | Runner | Command |
| --- | --- | --- |
| Frontend | Vitest + React Testing Library + jsdom | `cd frontend && npm run test` |
| Backend | pytest + httpx | `cd backend && pytest` |

Static analysis:

| Stack | Tool | Command |
| --- | --- | --- |
| Frontend | TypeScript + ESLint | `npm run typecheck`, `npm run lint` |
| Backend | mypy strict + ruff | `mypy app`, `ruff check app` |

CI runs all four on every push. See
[`.github/workflows/ci.yml`](./.github/workflows/ci.yml).

## Deployment

### Backend on Render (recommended)

A `render.yaml` blueprint is committed at the repo root. It provisions a
single Docker web service that builds from `backend/Dockerfile`, runs
`uvicorn app.main:app --host 0.0.0.0 --port $PORT`, and uses `/health` as
the liveness probe.

1. In Render, click **New → Blueprint** and point it at this repo.
2. Render reads [`render.yaml`](./render.yaml) and provisions the service.
3. Set the one required env var when prompted:
   - `ALLOWED_ORIGINS` → the Vercel origin, e.g.
     `https://twinmind-live-suggestions.vercel.app` (comma-separated if
     multiple).
4. Auto-deploy is on. Every push to `main` redeploys.

If you are configuring the service manually in the dashboard instead:

| Field | Value |
| --- | --- |
| Runtime | Docker |
| Dockerfile Path | `backend/Dockerfile` |
| Docker Build Context Directory | `backend` |
| Start Command | leave blank; the Dockerfile's `CMD` runs uvicorn |
| Health Check Path | `/health` |
| Env: `ALLOWED_ORIGINS` | your Vercel URL |

Staying on the native Python runtime instead of Docker also works. In that
case `backend/.python-version` pins Python to 3.11, and you must set the
start command yourself to:

```
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

### Backend on Railway (alternative)

A `Dockerfile`, `Procfile`, and `railway.toml` are committed. Railway builds
from the `Dockerfile`, runs the same uvicorn command, and hits `/health` for
its liveness check. Set `ALLOWED_ORIGINS` the same way.

### Frontend on Vercel

Point Vercel at the `frontend/` directory. Set the single required env var:

- `NEXT_PUBLIC_BACKEND_URL` → the public Render or Railway URL of your
  backend.

A `.env.example` is committed at `frontend/.env.example` as a reference.

### Post-deploy check

1. Open the Vercel URL.
2. Visit Settings, paste a valid Groq key, press Apply.
3. Return home, press the mic, speak for 60 seconds.
4. Expect one transcript bubble, one suggestions batch, and a responsive chat.

## What I would do with more time

- Iterate the three prompts against real TwinMind sessions.
  `docs/observations.md` is the template.
- Rolling transcript summary for sessions above ~5 minutes.
- Per-type context tuning. `fact_check` benefits from a longer window than
  `clarification`. Currently all types share one knob.
- Streaming cancellation. A stop button that actually aborts the upstream
  Groq call via `AbortController`.
- Latency telemetry in Settings: time-to-first-token for chat, time-to-render
  for suggestions, p50 / p95 / p99.
- Automated evaluation harness with fixed transcript fixtures and a rubric.
  Catches prompt-quality regressions between edits.
- Alternative export formats: Markdown, CSV, JSON.
- Keyboard shortcuts: `M` to toggle mic, `Cmd+K` to focus chat, `1 2 3` to
  click the current batch suggestions.
- Retry and re-arm after `auto-stopped` or `interrupted`, so the user does not
  have to reload.
- Error telemetry. Right now failures show toasts and pills. A real service
  would emit counters to an observability tool.

## Documentation map

Everything under `docs/` is meant for reviewers and future maintainers.

- [`docs/spec.md`](./docs/spec.md) — full functional spec.
- [`docs/architecture.md`](./docs/architecture.md) — data flow, state shape,
  API contract.
- [`docs/prompt-strategy.md`](./docs/prompt-strategy.md) — prompt principles
  and templates.
- [`docs/prototype-notes.md`](./docs/prototype-notes.md) — UI spec.
- [`docs/observations.md`](./docs/observations.md) — template for hands-on
  TwinMind product notes that drive prompt tuning.
- [`docs/features/`](./docs/features/) — per-feature doc set
  (`README.md`, `design.md`, `edge-cases.md`, `implementation-plan.md`,
  `schemas.md`, `sub-features.md`, `out-of-scope.md`, and `prompts.md` where
  relevant).
- [`WORKFLOW.md`](./WORKFLOW.md) — the 6-phase feature workflow every change
  follows.
- [`CLAUDE.md`](./CLAUDE.md) — internal engineering rulebook.

## License

MIT. See [`LICENSE`](./LICENSE).
