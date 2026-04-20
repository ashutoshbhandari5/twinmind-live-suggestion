<!--
Thanks for the PR. Keep the description short. The checklist at the bottom is
not optional. See CONTRIBUTING.md for full guidance.
-->

## Summary

<!-- One or two sentences about what changes and why. -->

## Type of change

- [ ] Feature
- [ ] Fix
- [ ] Refactor (no behavior change)
- [ ] Docs
- [ ] Tests
- [ ] Chore

## Linked feature doc

<!-- Path under docs/features/<name>/, or "N/A" if not applicable. -->

`docs/features/...`

## Manual verification

<!-- Steps a reviewer can follow to reproduce the new or fixed behavior. -->

1. ...
2. ...
3. Expected: ...

## Screenshots or screen capture

<!-- Optional but appreciated for any UI change. -->

## Checklist

- [ ] `cd frontend && npm run typecheck && npm run lint && npm run test` pass.
- [ ] `cd backend && ruff check app && mypy app && pytest` pass.
- [ ] No API key, transcript, or personal audio in the diff.
- [ ] No new UI primitive built by hand when shadcn/ui provides one.
- [ ] No inline prompts; all prompt text lives in `frontend/lib/prompts.ts`.
- [ ] New or changed behavior is covered by tests.
- [ ] Docs updated if this changes the spec, architecture, or prompt strategy.
