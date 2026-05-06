<!--
Thanks for sending a PR. Please fill in every section below — the project's
review process leans on this template, and missing context is the most
common reason a PR sits in limbo.

Title format: imperative summary, ending with `(#issue-number)`.
Examples in `git log --oneline`.
-->

## Linked issue

Closes #<!-- issue number -->

## Summary

<!-- 1–3 bullets on what this PR changes and *why*. The diff already says
what; explain the motivation. -->

-

## Acceptance criteria

<!-- Restate the issue's acceptance criteria, one check-box per item. The
reviewer flips boxes to confirm; please pre-check the ones you've done. -->

- [ ] ...
- [ ] ...

## Architectural notes

<!-- ADR(s) this PR implements, extends, or supersedes. If the PR
introduces a new seam or a non-trivial design choice, an ADR should land
in this PR or be referenced from a follow-up issue. -->

- ADR(s): docs/adr/NNNN-...

## Test plan

<!-- What you ran locally before pushing. Tick each box; CI re-runs on
PR open. -->

- [ ] `pnpm install`
- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] Package-scoped tests where relevant: `pnpm -r --filter @sosb/<name> run test`
- [ ] Playwright e2e (if the change crosses package boundaries): `pnpm test:e2e`
- [ ] New / updated golden files reviewed manually for byte-exact correctness

## Screenshots / recordings (UI changes)

<!-- For editor or theme changes, attach before/after screenshots or a
short screen recording. -->

## Follow-ups

<!-- Anything you intentionally deferred. Link the issue you opened (or
will open) for each. -->

-

## Checklist

- [ ] PR title is verb-first and ends with `(#<issue>)`.
- [ ] Commit history is clean (one logical commit per change, no
      merge / fix-up noise).
- [ ] No personal data in commit messages, fixtures, or screenshots.
- [ ] No emoji added to source files unless explicitly requested.
- [ ] Public APIs touched? README / package READMEs / CONTRIBUTING updated
      where the change is user-visible.
