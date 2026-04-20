# Documentation index

Everything under this folder is for reviewers and future maintainers.
Start at the root [`README.md`](../README.md) for the 60 second tour, then
dive into whichever doc below matches the question you have.

## Top-level docs

| File | What it is |
| --- | --- |
| [`spec.md`](./spec.md) | Functional requirements. Source of truth for what the app must do. |
| [`architecture.md`](./architecture.md) | Component graph, data flow, state shape, API contract. |
| [`prompt-strategy.md`](./prompt-strategy.md) | Principles behind the three prompts and how the USER turn is assembled per call. |
| [`prototype-notes.md`](./prototype-notes.md) | UI spec: layout, color, spacing, interaction patterns. |
| [`observations.md`](./observations.md) | Template for hands-on TwinMind product sessions. Post-baseline prompt iteration cites evidence from here. |

## Feature docs

Each feature owns one folder under `features/`. Every folder contains the same
set of files. Files are optional if empty (e.g. `prompts.md` only exists when
the feature touches `frontend/lib/prompts.ts`).

| Feature | Folder |
| --- | --- |
| Mic and transcription | [`features/mic-and-transcription/`](./features/mic-and-transcription/) |
| Live suggestions | [`features/live-suggestions/`](./features/live-suggestions/) |
| Chat with streaming | [`features/chat-with-streaming/`](./features/chat-with-streaming/) |
| Export | [`features/export/`](./features/export/) |

Per-feature file set:

- `README.md` — what the feature is, why it exists, success criteria.
- `design.md` — component tree, state changes, data flow.
- `edge-cases.md` — numbered list of every edge case the implementation must
  cover. Tests pull from this file directly.
- `implementation-plan.md` — ordered steps with complexity tags.
- `out-of-scope.md` — explicit exclusions.
- `schemas.md` — request and response shapes (when applicable).
- `sub-features.md` — if the feature has sub-features.
- `prompts.md` — prompt text and rationale (when the feature touches prompts).

## Workflow and engineering rules

These live at the repo root, not under `docs/`, because they apply to all work.

- [`../WORKFLOW.md`](../WORKFLOW.md) — the 6-phase workflow (Understand → Docs
  → Gate → Plan → Gate → Implement → Verify → Tests → Ready).
- [`../CLAUDE.md`](../CLAUDE.md) — internal engineering rulebook.
- [`../CONTRIBUTING.md`](../CONTRIBUTING.md) — how to propose and submit a
  change.
- [`../SECURITY.md`](../SECURITY.md) — API key handling, what the backend
  stores, how to report an issue.

## How to read the docs for a given task

| You want to... | Read this first |
| --- | --- |
| Understand what the app does | `../README.md` → `spec.md` |
| Touch a prompt | `prompt-strategy.md` → `observations.md` → the relevant feature folder's `prompts.md` |
| Add a new endpoint | `architecture.md` → the relevant feature's `schemas.md` |
| Change the UI | `prototype-notes.md` → the feature's `design.md` |
| Add a feature | `../WORKFLOW.md` (mandatory), then create a new folder under `features/` |
| Investigate a bug | The feature's `edge-cases.md` |
