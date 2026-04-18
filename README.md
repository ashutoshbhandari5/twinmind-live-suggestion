# TwinMind Live Suggestions

Take-home assignment. A web app that listens to live audio from the user's mic
and surfaces 3 useful suggestions every 30 seconds, with a chat column for
detailed follow-ups.

## Live demo

- App: TBD (Vercel)
- API: TBD (Railway)

## Repo

- GitHub: TBD

## Stack

- Frontend: Next.js 15 App Router, TypeScript strict, Tailwind v4, shadcn/ui, Zustand, React Query
- Testing: Vitest with React Testing Library and jsdom (frontend), pytest (backend)
- Backend: FastAPI, Python 3.11, httpx
- Models: Groq Whisper Large V3 (transcription), Groq GPT-OSS 120B (suggestions and chat)
- Deploy: Vercel (frontend), Railway (backend)

## Setup

Frontend:

```
cd frontend
npm install
npm run dev
```

Backend:

```
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The backend does not hold an API key. Paste your Groq key into the Settings
page in the app. The key is sent per-request in the `x-groq-api-key` header.

## Architecture

```
Browser (Next.js)
  mic capture → MediaRecorder 30s chunks → POST /transcribe
  every 30s                              → POST /suggestions (recent transcript)
  suggestion click or typed message      → POST /chat (streamed chunked text)

FastAPI (stateless)
  forwards each call to Groq with the user's key from the header
```

Client holds all session state in Zustand. Backend stores nothing.

## Prompt strategy

Three editable prompts live in `frontend/lib/prompts.ts`. The user can override any of them at runtime via Settings.

- `SUGGESTION_PROMPT` fires every 30 seconds when a new transcript chunk lands. Output is strict JSON with one retry on malformed, then 502.
- `DETAILED_ANSWER_PROMPT` fires when the user clicks a suggestion card. Output is Markdown streamed token-by-token.
- `CHAT_PROMPT` fires when the user types a question directly. Output is Markdown streamed token-by-token.

### SYSTEM vs. USER split

Every prompt follows the same pattern: the user-editable string is the SYSTEM message. The USER message is assembled by the backend with live context. The user cannot break templating by editing the wrong half.

- Suggestions USER turn: session duration, last N transcript chunks (default 3, Settings-tunable), previous batch for dedup, instruction to output JSON only.
- Chat USER turn: full transcript (in the SYSTEM message), full prior chat history as real chat-completion turns, and a final synthesized turn. For a typed question the final turn is the user's raw text. For a suggestion click it is `Click-through: [type] preview / Internal reasoning: ... / Explain in depth using transcript and prior chat as context.`

### Classification before generation

The suggestions prompt forces the model to name the conversational moment before picking suggestion types. Six canonical values: `question_asked`, `claim_made`, `decision_point`, `topic_exploration`, `unfamiliar_term`, `idle`. The classification is returned in the response and rendered on the batch divider (`— BATCH 3 · 01:08:16 PM · Question asked —`) so reviewers can see the model committed to a moment before picking suggestions. Mixing types is allowed when the moment supports it; three answers to a question is correct, three clarifications when nothing is unclear is wrong.

### Batch dedup

Each suggestions request ships the previous batch's previews back to the model with an explicit "avoid repeating" instruction. The prompt tells the model to advance the conversation rather than repeat itself.

### Preview quality bar

The prompt hardcodes what a good vs. bad preview looks like. "You could ask about their revenue" is rejected; "Their Q3 revenue grew 34% YoY to $2.1B per last earnings call" is the target. Both chat prompts have anti-boilerplate rules (`Do not start with "I'd be happy to"`, `Do not re-quote the user's question`).

### Temperature

Hardcoded at 0.3 for suggestions (grounding) and 0.5 for chat (fluency). Not exposed in Settings to keep demo output consistent across runs. Prompt edits are the tuning surface.

### Context windowing

- Suggestions: last N transcript chunks (chunk-based, default 3). Chunk-based beats time-based because manual-refresh produces sub-30s chunks and we want consistent context size regardless.
- Chat: full transcript + full prior chat history on every request. Rolling summary for long sessions is a deferred improvement.

## Tradeoffs and decisions

Deliberate choices worth calling out. See `docs/features/*/` for per-feature detail.

- **30s transcript chunks, one bubble per chunk.** Matches the spec. Shorter chunks would quintuple Groq spend for marginal UX gain. No sentence-splitting in the UI; a chunk is a chunk.
- **Chunk-based suggestion context (not seconds).** Because manual refresh flushes mid-chunk, time-based windowing produces uneven context sizes. Chunk-based is stable.
- **Strict JSON for suggestions with one retry, then 502.** Hides a malformed-output bug once; surfaces it after two. Generous retries would let a broken prompt limp along.
- **Raw chunked text for chat streaming, not SSE.** Simpler wire; the "Connection interrupted" pill covers the tradeoff that we cannot distinguish "done" from "error mid-stream" on the HTTP layer.
- **Markdown rendering only on assistant messages.** User messages are verbatim plain text so the model's output cannot echo-inject HTML back into the DOM. Assistant Markdown runs through `react-markdown` with `skipHtml`, dropped images, and forced `target="_blank" rel="noopener noreferrer"` on links.
- **Client-side blob download for export, not the backend endpoint.** The browser already holds every byte of the session in Zustand. A network hop for the server to echo the same bytes back adds latency and a failure mode for zero value.
- **Backend is stateless.** No DB, no session storage, no key persistence. The Groq key is sent per request in `x-groq-api-key` and never logged. This is a take-home constraint; a real service would look different.
- **Hardcoded temperatures.** One setting more to tune is one more thing to demo wrong. Two prompts and their per-type context windows are already the right tuning surface.
- **`moment_type` surfaced on the batch divider.** Visible signal that the model committed to a classification before generating. Helps reviewers see the pattern.
- **Newest-batch highlighting via colored ring + older-batch opacity dim.** Eye lands on the fresh batch in under a second during a live conversation. Type badges stay colored on all batches so type is still scannable.
- **6-phase feature workflow with gates at doc review, plan review, and manual verification.** See `WORKFLOW.md`. Overkill for a take-home, but it kept the code clean and it is what produced the per-feature docs under `docs/features/`.

## What I would do with more time

- **Iterate the three prompts against real TwinMind sessions.** Shipped prompts are a thoughtful v1 but untested against a real meeting corpus. `docs/observations.md` is the template.
- **Rolling transcript summary.** Kicks in when a session exceeds ~5 minutes. Keeps suggestion context relevant without blowing up tokens on every call.
- **Per-type context tuning.** `fact_check` benefits from a longer window than `clarification`. Currently all types share one knob.
- **Streaming cancellation.** Stop button on the assistant response should actually abort the upstream Groq call via `AbortController`.
- **Latency telemetry in Settings.** Time-to-first-token for chat, time-to-render for suggestions, p50/p95/p99. Lets the user tune prompt size against perceived speed.
- **Automated evaluation harness.** Fixed transcript fixtures, run the suggestion prompt, score against a rubric. Catches prompt-quality regressions between edits.
- **Alternative export formats.** Markdown or CSV for reviewers who want to skim; JSON for machines.
- **Keyboard shortcuts.** `M` to toggle mic, `Cmd+K` to focus chat, number keys 1-3 to click the current batch's suggestions.
- **Retry and re-arm.** Three-strike auto-stop and "Connection interrupted" pills both currently require a page reload to recover. A Retry button would be small and kind.
- **Error telemetry.** Right now failures show toasts or pills. A real service would ship counters to an observability tool.

## Notes on TwinMind product usage

Detailed observations from hands-on sessions with the TwinMind product belong in `docs/observations.md`. That file drives the post-baseline prompt iteration pass; any changes to `frontend/lib/prompts.ts` after v1 should cite specific failure modes captured there.
