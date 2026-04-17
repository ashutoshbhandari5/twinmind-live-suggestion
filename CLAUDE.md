# CLAUDE.md

Take-home assignment for TwinMind (AI meeting copilot, Menlo Park). Role: Full Stack / Prompt Engineer. Prompt quality is evaluated first, engineering second.

## Workflow is mandatory

Every feature follows the 6-phase workflow in `WORKFLOW.md`. Read it before starting any feature work.

Phases: Understand → Docs → Doc review gate → Plan → Plan review gate → Implement → Manual verify gate → Tests → Ready.

Never skip phases. Never combine phases. Wait for explicit user approval at every gate.

If the user asks to "just code it," remind them of the workflow and ask which phase to start from.

## Critical rules

- **Never hardcode the Groq API key.** User pastes their own in Settings. Key is passed via `x-groq-api-key` header per request. Never log it.
- **Models are fixed: Groq Whisper Large V3 (transcription) and Groq GPT-OSS 120B (suggestions and chat).** No other models under any circumstance.
- **Every prompt lives in `frontend/lib/prompts.ts` as an exported constant, editable via Settings.** Do not inline prompts in components or route handlers.
- **Use shadcn/ui for UI components. Never build custom versions of components shadcn provides.** Button, Input, Textarea, Card, Dialog, ScrollArea, Badge, Toast, Tooltip, Label, Separator, Skeleton all come from shadcn. Only build custom components for domain-specific UI (MicButton, SuggestionCard, TypeBadge, TranscriptChunk).
- **Do not over-engineer.** The spec says so explicitly. Scope is a take-home, not production at scale.

## What the product does

Three-column web app:

1. Mic + live transcript (left)
2. Live suggestions, 3 per batch, refreshed every 30s (middle)
3. Chat with streamed detailed answers (right)

See `docs/spec.md` for full functional requirements and `docs/prototype-notes.md` for UI spec.

## Stack

- Frontend: Next.js 15 App Router, TypeScript strict, Tailwind, shadcn/ui, Zustand, React Query
- Backend: FastAPI, Python 3.11, httpx (async)
- Deploy: Vercel (frontend), Railway (backend)

## Commands

Frontend (`cd frontend`):

- Dev: `npm run dev`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Test: `npm run test`
- Add shadcn component: `npx shadcn@latest add <component>`

Backend (`cd backend`):

- Dev: `uvicorn app.main:app --reload`
- Typecheck: `mypy app`
- Lint: `ruff check app`
- Test: `pytest`

Run typecheck, lint, and tests before committing.

## Architecture

```
Browser (Next.js)
  mic → MediaRecorder 30s chunks → POST /transcribe
  every 30s → POST /suggestions
  suggestion click → POST /chat (SSE stream)

FastAPI (stateless, no DB)
  forwards to Groq with user's API key from header
```

All session state lives in Zustand on the client. Backend stores nothing. See `docs/architecture.md` for detail.

## UI component rules

- Base primitives (buttons, inputs, cards, dialogs, badges, scroll areas, tooltips): always shadcn/ui
- Domain components (MicButton, SuggestionCard, TypeBadge, TranscriptChunk, ChatMessage): built from shadcn primitives + Tailwind
- Icons: lucide-react
- No other UI libraries (no MUI, Chakra, Radix direct)
- Use `cn()` from `lib/utils.ts` for conditional classes
- Dark mode only. No theme toggle. Match colors in `docs/prototype-notes.md`.

## Prompt engineering is the priority

The suggestions prompt must:

- Classify the conversational moment before generating (question asked, claim made, topic shift, etc.)
- Return exactly 3 suggestions in strict JSON
- Each preview delivers value UNCLICKED. "You could ask about their revenue" is a failure. "Their Q3 revenue grew 34% YoY per last earnings call" passes.
- Mix types when the moment allows. Do not force variety when one type dominates.

Types: `question`, `talking_point`, `answer`, `fact_check`, `clarification`.

Full prompt strategy in `docs/prompt-strategy.md`. Read before touching prompts.

## Code conventions

- TypeScript strict mode. No `any`. Shared types in `lib/types.ts`.
- Python: type hints on every function, Pydantic for schemas, async only.
- Named exports in TS. No default exports except Next.js pages.
- Error handling is required on every network call. No silent failures.
- Comments explain WHY, not WHAT.

## Writing style for READMEs, comments, commits

- Clear, simple language. Short sentences. Active voice.
- No em dashes. Use periods or commas.
- No marketing language (groundbreaking, powerful, leverage, harness, dive deep, unlock).
- Commits: conventional format, lowercase imperative. Example: `feat: add mic button with pulse animation`.

## Testing standards

For each feature, cover:

- Happy path
- Sad path (user errors, validation fails)
- Edge cases documented in the feature's `edge-cases.md`
- Boundary conditions (empty, max, zero, null)
- Error handling (network, API, timeout)
- State transitions for stateful features

Frontend: Vitest + React Testing Library. Test behavior, not implementation.
Backend: pytest + httpx. Test endpoints with valid and invalid inputs.

## What will fail the submission

- Hardcoded API key
- Missing deployment URL or broken demo
- Generic suggestion previews
- Custom-built button, input, or card when shadcn provides them
- No error handling when Groq fails or API key is invalid
- No export button
- Skipping workflow phases
- README that does not explain prompt strategy and tradeoffs

## Session protocol

Start of every session:

1. Read `CLAUDE.md` and `WORKFLOW.md`
2. Read `docs/prompt-strategy.md` if touching prompts
3. Read `docs/observations.md` before prompt iteration
4. Confirm current phase of current feature before acting

End of every session:

1. Print what was done and what phase completed
2. Print what the next phase requires from user
3. Run typecheck, lint, and tests

## References

- Workflow: `WORKFLOW.md`
- Full spec: `docs/spec.md`
- Architecture: `docs/architecture.md`
- Prompt strategy: `docs/prompt-strategy.md`
- Product observations: `docs/observations.md`
- UI spec: `docs/prototype-notes.md`
- Feature docs: `docs/features/<feature-name>/`
