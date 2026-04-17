# WORKFLOW.md

Every new feature follows this exact process. Do not skip phases. Do not combine phases. Wait for user approval at each gate.

## The 6 phases

### Phase 1: Understand

When the user describes a new feature, do NOT start coding or writing docs.

Ask clarifying questions until you understand:

- What the feature does from the user's perspective
- Success criteria
- Edge cases and failure modes
- Dependencies in and out
- What is explicitly out of scope

Never assume. If ambiguous, ask. If the user says "use your judgment," confirm the specific decision before proceeding.

Proceed to Phase 2 only after the user confirms.

### Phase 2: Feature doc

Create one file: `docs/features/<feature-name>/FEATURE.md`

The doc has these sections in this order:

1. **Status** — one line: current phase, last updated date
2. **What this is** — 2-3 sentences
3. **Why it exists** — user problem it solves
4. **Success criteria** — checklist of observable outcomes
5. **Sub-features** — if any, as a short bullet list, not separate files
6. **Design** — component tree, state changes, data flow, API contract changes
7. **Edge cases** — numbered list, every case that must be handled
8. **Out of scope** — explicit exclusions
9. **Schemas** — only if this feature changes request/response shapes
10. **Prompts** — only if this feature touches `lib/prompts.ts`

Keep the doc scannable. Prefer bullet lists and short prose over walls of text. Target 150-300 lines total. If the doc exceeds 400 lines, split into sub-features (each gets its own folder and its own FEATURE.md) rather than padding one giant file.

### Phase 3: Doc review gate

After writing FEATURE.md, stop. Ask:

> FEATURE.md is ready at `docs/features/<feature-name>/FEATURE.md`. Please review. Approve, or request changes?

If approved: FEATURE.md is frozen for this cycle. Proceed to Phase 4.
If changes: update and ask again.

Do not write code in this phase.

### Phase 4: Implementation plan

Append an `## Implementation plan` section to the same FEATURE.md file. Do not create a separate plan file.

The plan section contains:

- Ordered steps (file path, what changes in each)
- Dependencies between steps
- Complexity tag per step (low, medium, high)
- Risks and unknowns

If the plan reveals a flaw in the earlier doc sections, note it in the plan as "Doc correction" and include the corrected text inline. Do not silently edit the doc body. The user sees all corrections in the plan and approves both together in Phase 5.

### Phase 5: Plan review gate

Ask:

> Implementation plan is appended to FEATURE.md. If any doc corrections are flagged, they are in the plan. Approve both, or request changes?

If approved: apply any flagged doc corrections to the doc body, then proceed to Phase 6.
If changes: update the plan and ask again.

### Phase 6: Implementation

Execute the plan step by step. For each step:

- Make the change
- Run typecheck and lint
- Verify the change compiles

When the full feature is implemented, stop and ask:

> Implementation is done. Please verify manually. When ready, I will write tests.

Do NOT write tests until user confirms manual verification passes.

### Phase 7: Tests

Once user verifies, write tests covering:

- Happy path (typical successful usage)
- Sad path (user errors, validation failures)
- Every numbered edge case from the Edge cases section
- Boundary conditions (empty, max, zero, null)
- Error handling (network fails, API fails, timeouts)
- State transitions for stateful features
- Positive and negative cases

Frontend: Vitest + React Testing Library. Test user interactions, not implementation details.
Backend: pytest + httpx. Test endpoints with valid and invalid inputs.

After tests pass, ask:

> All tests pass. Feature is ready. Mark as complete?

If yes: update FEATURE.md status to `Complete` with the commit SHA. Commit with `feat: complete <feature-name>`.

## Rules across all phases

- Never skip phases.
- Every gate ends with explicit user approval.
- One file per feature: `FEATURE.md`. Sub-features get their own folder with their own FEATURE.md.
- FEATURE.md is the source of truth. If code diverges, update FEATURE.md first, then code.
- Never ask the user to re-approve the same gate twice. If a doc correction is needed after the doc gate, surface it in the plan and cover both in the plan gate.
- Keep feature folders forever. Future devs read them to understand decisions.

## Folder structure

```
docs/features/
  mic-and-transcription/
    FEATURE.md                one file, all sections, with plan appended
  live-suggestions/
    FEATURE.md
    rolling-summary/          sub-feature as its own folder
      FEATURE.md
  chat-with-streaming/
    FEATURE.md
```

## When the user starts a new feature

Respond with:

> Starting Phase 1 for <feature-name>. Let me ask some questions before anything else.

Then ask clarifying questions. No code. No docs.
