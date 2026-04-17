# WORKFLOW.md

Every new feature follows this exact process. Do not skip steps. Do not combine steps. Wait for user approval at each gate.

## The 6 phases

### Phase 1: Understand

When the user describes a new feature, do NOT start coding or writing docs.

First, ask clarifying questions until you understand:

- What the feature does from the user's perspective
- What the success criteria are
- What the edge cases are
- What depends on this feature and what this feature depends on
- What is explicitly out of scope

Ask as many questions as needed. Never assume. If something is ambiguous, ask. If the user says "use your judgment," confirm the specific decision before moving on.

Only after the user confirms you understand do you proceed to Phase 2.

### Phase 2: Feature folder and docs

Create a folder for the feature: `docs/features/<feature-name>/`

Inside, write these files:

- `README.md`: what this feature is, why it exists, success criteria
- `sub-features.md`: list of sub-features this feature contains, each with its own short spec
- `design.md`: how this feature is structured (components, data flow, state changes, API endpoints)
- `edge-cases.md`: every edge case and failure mode you and the user identified
- `out-of-scope.md`: what is explicitly NOT part of this feature

Name sub-feature sub-folders if the feature is complex: `docs/features/<feature-name>/<sub-feature-name>/`

If the feature touches prompts, add `prompts.md` describing prompt changes.
If the feature touches schemas, add `schemas.md` describing API contract changes.

### Phase 3: Doc review gate

After writing docs, stop. Ask the user: "Docs are ready. Please review `docs/features/<feature-name>/`. Do you approve, or do you have changes?"

If user approves: proceed to Phase 4.
If user has changes: update docs, then ask again. Loop until approved.

Do not write any code during this phase.

### Phase 4: Implementation plan

Before writing code, write an implementation plan as `docs/features/<feature-name>/implementation-plan.md`.

The plan contains:

- Ordered list of concrete changes (file paths, what changes in each)
- Dependencies between changes (what must be done first)
- Estimated complexity per step (low/medium/high)
- Risks and unknowns

Ask the user: "Implementation plan is ready. Do you approve, or do you have changes?"

If user approves: proceed to Phase 5.
If user has changes: update plan, then ask again.

### Phase 5: Implementation

Execute the plan step by step. For each step:

- Make the change
- Run typecheck and lint
- Verify the change works

When the full feature is implemented, stop and ask: "Implementation is done. Please verify manually. When ready, I will write tests."

Do NOT write tests until user confirms manual verification passes.

### Phase 6: Tests

Once user verifies, write tests covering:

- Happy path (typical successful usage)
- Sad path (user errors, validation failures)
- Edge cases from `edge-cases.md`
- Boundary conditions (empty inputs, max sizes, zero, null)
- Error handling (network fails, API fails, timeouts)
- State transitions (for stateful features)
- Positive cases (what should succeed)
- Negative cases (what should fail and how)

For frontend: React Testing Library + Jest/Vitest. Test user interactions, not implementation details.
For backend: pytest + httpx for API tests. Test endpoints with valid and invalid inputs.

After tests pass, ask the user: "All tests pass. Feature is ready. Mark as complete?"

If yes: update `docs/features/<feature-name>/README.md` with a "Status: Complete" line and ask user to commit the code don't commit yourself.

## Rules across all phases

- Never skip phases. If user says "just code it," remind them of the workflow and ask which phase to start from.
- Every phase ends with explicit user approval before moving forward.
- Docs are the source of truth. If code diverges from docs, update docs first, then code.
- If a feature is too large, break it into sub-features at Phase 2. Each sub-feature gets its own folder and its own 6-phase cycle.
- Keep feature folders forever. Future devs read them to understand why decisions were made.

## Example feature structure

```
docs/features/
  mic-and-transcription/
    README.md
    sub-features.md
    design.md
    edge-cases.md
    out-of-scope.md
    implementation-plan.md
    chunking-strategy/
      README.md
      design.md
      edge-cases.md
  live-suggestions/
    README.md
    sub-features.md
    design.md
    edge-cases.md
    prompts.md
    out-of-scope.md
    implementation-plan.md
  chat-with-streaming/
    README.md
    design.md
    edge-cases.md
    schemas.md
    implementation-plan.md
```

## When the user starts a new feature

Respond with: "Starting Phase 1 for <feature-name>. Let me ask some questions before anything else."

Then ask clarifying questions. Do not write code or docs yet.
