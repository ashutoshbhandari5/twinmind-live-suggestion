# Contributing

Thanks for taking the time to read this. The rules below are short because the
project is small. The important one is the feature workflow, which is
non-optional.

## Ground rules

1. **Read [`WORKFLOW.md`](./WORKFLOW.md) before starting any feature.** Every
   feature is planned, doc-reviewed, plan-reviewed, implemented, manually
   verified, and tested, in that order. No skipping phases.
2. **Read [`CLAUDE.md`](./CLAUDE.md) before touching prompts, UI primitives, or
   the backend contract.** It captures the non-obvious constraints (fixed
   models, no hardcoded API key, shadcn-only for primitives, no default
   exports, etc.).
3. **Writing style:** clear, simple, short sentences, active voice. No
   marketing words (`powerful`, `leverage`, `harness`, `unlock`, `dive deep`).
   No em dashes. Comments explain WHY, not WHAT.
4. **Do not introduce a new system when extending the current one works.**
   Reuse the existing hooks, stores, route patterns, prompt file, and error
   shapes. Additive migrations only.

## Local development

See the root [`README.md`](./README.md#quick-start) for the 60 second path.

Extras you will likely want:

```bash
cd frontend
npm run typecheck
npm run lint
npm run test

cd ../backend
source .venv/bin/activate
ruff check app
mypy app
pytest
```

All four must pass before you open a pull request. CI runs the same four.

## Branch and commit conventions

- Branch name: `feat/<short-slug>`, `fix/<short-slug>`, `docs/<short-slug>`,
  `chore/<short-slug>`.
- Commit format: conventional, lowercase imperative. One logical change per
  commit.
  - `feat: add stop button to assistant bubble`
  - `fix: keep recorder state across settings navigation`
  - `docs: add SECURITY.md`
  - `test: cover suggestions malformed retry`
- Do not commit `.env`, `.env.local`, audio fixtures over 1 MB, or `node_modules`.

## Pull requests

Open a PR against `main`. The PR description follows the template at
[`.github/PULL_REQUEST_TEMPLATE.md`](./.github/PULL_REQUEST_TEMPLATE.md).

PR checklist:

- [ ] Linked feature doc under `docs/features/` (or a note that none is needed).
- [ ] `npm run typecheck && npm run lint && npm run test` pass locally.
- [ ] `ruff check app && mypy app && pytest` pass locally.
- [ ] No API key, transcript, or personal audio in the diff.
- [ ] Manual verification steps listed in the PR body.

## Reporting bugs

Open an issue with the bug template. Include:

- What you did (1-5 steps).
- What you expected.
- What actually happened, including the pill text or toast text if relevant.
- Browser and OS.
- Whether the Groq key is valid and has quota.

## Requesting features

Open an issue with the feature template. Propose the smallest safe next step,
not a rewrite. If the feature is non-trivial, expect to go through
[`WORKFLOW.md`](./WORKFLOW.md) in full.
