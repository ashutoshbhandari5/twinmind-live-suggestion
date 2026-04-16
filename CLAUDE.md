# CLAUDE.md

Take-home assignment for TwinMind (AI meeting copilot, Menlo Park). Role: Full Stack / Prompt Engineer. Prompt quality is evaluated first, engineering second.

## Critical rules

- **Never hardcode the Groq API key.** User pastes their own in Settings. Key is passed via `x-groq-api-key` header per request. Never log it.
- **Models are fixed: Groq Whisper Large V3 (transcription) and Groq GPT-OSS 120B (suggestions and chat).** No other models under any circumstance.
- **Every prompt lives in `frontend/lib/prompts.ts` as an exported constant, editable via Settings.** Do not inline prompts in components or route handlers.
- **Do not over-engineer.** The spec says so explicitly. Scope is a take-home, not production at scale.

## What the product does

Three-column web app:

1. Mic + live transcript (left)
2. Live suggestions, 3 per batch, refreshed every 30s (middle)
3. Chat with streamed detailed answers (right)

See `docs/spec.md` for full functional requirements and `docs/prototype-notes.md` for UI spec from the reference mockup.

## Stack

- Frontend: Next.js 15 App Router, TypeScript strict, Tailwind, Zustand, React Query
- Backend: FastAPI, Python 3.11, httpx (async)
- Deploy: Vercel (frontend), Railway (backend)

## Commands

Frontend (`cd frontend`):

- Dev: `npm run dev`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`

Backend (`cd backend`):

- Dev: `uvicorn app.main:app --reload`
- Typecheck: `mypy app`
- Lint: `ruff check app`

Always run typecheck and lint before committing.

## Architecture

```
Browser (Next.js)
  mic → MediaRecorder 30s chunks → POST /transcribe
  every 30s → POST /suggestions (recent transcript)
  suggestion click → POST /chat (SSE stream)

FastAPI (stateless, no DB)
  forwards to Groq with user's API key from header
```

All session state lives in Zustand on the client. Backend stores nothing. See `docs/architecture.md` for detail.

## Prompt engineering is the priority

The suggestions prompt must:

- Classify the conversational moment before generating (question asked, claim made, topic shift, etc.)
- Return exactly 3 suggestions in strict JSON
- Each preview delivers value UNCLICKED. "You could ask about their revenue" is a failure. "Their Q3 revenue grew 34% YoY per last earnings call" passes.
- Mix types when the moment allows. Do not force variety when one type dominates.

Types: `question`, `talking_point`, `answer`, `fact_check`, `clarification`.

Full prompt strategy in `docs/prompt-strategy.md`. Read it before touching prompts.

## Code conventions

- TypeScript strict mode. No `any`. Shared types in `lib/types.ts`.
- Python: type hints on every function, Pydantic for schemas, async only.
- Named exports in TS. No default exports except Next.js pages.
- Error handling is required on every network call. No silent failures.
- Comments explain WHY, not WHAT.

Do not add comments to describe what code does. Readable code handles that.

## Writing style for READMEs, comments, commits

- Clear, simple language. Short sentences. Active voice.
- No em dashes. Use periods or commas.
- No marketing language (groundbreaking, powerful, leverage, harness, dive deep, unlock).
- Commits: conventional format, lowercase imperative. Example: `feat: add mic button with pulse animation`.

## What will fail the submission

- Hardcoded API key
- Missing deployment URL or broken demo
- Generic suggestion previews (the #1 evaluation criterion)
- No error handling when Groq fails or API key is invalid
- No export button
- README that does not explain prompt strategy and tradeoffs

## Session protocol

Start of every session:

1. Read this file
2. Read `docs/prompt-strategy.md` if touching prompts
3. Read `docs/observations.md` (TwinMind product usage notes) before prompt iteration
4. Confirm the pass scope before writing code

End of every session:

1. Print what was done and what remains
2. Suggest the next pass
3. Run typecheck and lint

## References

- Full spec: `docs/spec.md`
- Architecture detail: `docs/architecture.md`
- Prompt strategy: `docs/prompt-strategy.md`
- TwinMind product observations: `docs/observations.md`
- UI spec from prototype: `docs/prototype-notes.md`
