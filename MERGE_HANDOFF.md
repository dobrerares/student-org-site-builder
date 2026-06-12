# Post-orchestration handoff — three follow-ups

**State as of handoff (2026-05-06, end of session):**

- All 16 open PRs from the prior MERGE_HANDOFF are landed on `main`.
- `main` is at `944bbec` (see "What landed" below).
- 0 open PRs.
- 43 worktrees + `.worktrees/` directory removed.
- ADR slots deduplicated (10 renumbered to 0032–0041; 34 ADRs at unique slots now).

This file is **untracked** — don't commit. Delete when these three follow-ups are done.

---

## TL;DR — what's left

Three follow-ups surfaced during the merge orchestration. Two are real bugs blocking green CI; one is cosmetic.

```
1. cta-banner.tsx NPE on optional button   (1-line fix — fixes ~27 test failures)
2. packages/assets/src/index.ts is broken  (lost-merge of #8 browser pipeline)
3. ~30 bare "ADR NNNN" references stale    (cosmetic; safe to defer)
```

Recommended order: **fix #1** (5 min, immediate test wins) → **recover #2** (mirrors the #59 recovery I already did) → optionally do #3 later.

---

## What landed this session

```
944bbec Renumber duplicate ADR slots to sequential 0032-0041
bea9ffc Regenerate goldens + format after AFK orchestration completion
0bdd8df Add Electron asset pipeline: Sharp + responsive variants (#37) (#75)
c6a32f8 Add Electron auto-update via electron-updater + GitHub Releases (#36) (#90)
8012d23 Add per-theme axe-core a11y regression CI gate (#40) (#87)
da0d3c1 Add i18n framework + RO/EN editor translations (#42) (#89)
d518f02 Add repo docs: README + CONTRIBUTING + templates + block guide (#45) (#91)
77236ff Add Cloudflare Pages deploy guide + DEPLOY.md generator (#43) (#88)
bb74642 Add curated demo template: Asociația Studențească Demo (#34) (#86)
cb9b493 Add Academic theme (#47) (#85)
eb99869 Add Civic theme (#30) (#84)
32dc474 Add Editorial theme (#29) (#83)
f1d2ee3 Add Modern theme (#28) (#82)
a7a16a7 Add Minimal theme: tokens + hero golden (#31) (#81)
5779a1e Add block library picker + DnD reorder + undo/redo (#27) (#80)
a929ced Add Site Health panel + pre-export gate + build validation (#25) (#77)
f468321 Add SEO: Schema.org JSON-LD + Twitter Card + x-default (#39) (#78)
d39313c Add browser shell: service worker + archival single-file build (#38) (#79)
bc09d90 Add Electron shell: BrowserWindow + IPC + native dialogs (#35) (#92)  ← #59 recovery
```

17 commits this session. PR #92 was opened to recover #59's lost merge.

---

## Follow-up 1 — `cta-banner` NPE on optional button

### What's wrong

`packages/renderer/src/blocks/cta-banner.tsx:34` accesses `data.button.style` unconditionally. The schema treats `button` as optional (or `looseObject` lets the field be absent), and PR #86's demo template (`packages/themes/src/templates/asociatia-studenteasca-demo/data.json`) ships a `ctaBanner` without a button, hitting:

```
TypeError: Cannot read properties of undefined (reading 'style')
   at Object.call packages/renderer/src/blocks/cta-banner.tsx:34:30
```

This crashes 27 tests across `packages/themes/test/asociatia-studenteasca-demo.test.ts` (4 direct), `packages/build/test/build-shape.test.ts` (cascade), and others.

### Fix recipe

```typescript
// packages/renderer/src/blocks/cta-banner.tsx around line 22-50
const button = data.button;  // already there, type is `CtaBannerButton | undefined`

// ... later ...
{button !== undefined && (
  <a
    class={`ctaBanner__button ctaBanner__button--${button.style === "secondary" ? "secondary" : "primary"}`}
    href={button.href}
  >
    {button.label}
  </a>
)}
```

i.e. wrap the button JSX in a `button !== undefined` guard. Then the `buttonStyle` `const` only needs to exist inside that branch. Preserve the existing comments about "schema validates `style` is 'primary' or 'secondary'; we still default conservatively".

### Verify

```bash
cd "C:/Users/rdobr/Documents/anosr-site-builder"
npx vitest run packages/themes/test/asociatia-studenteasca-demo.test.ts
# Should be 4/4 passing instead of 4/4 failing.
npx vitest run --update    # regenerate any goldens that this fix shifts
```

If a golden HTML now renders without the button section (because the demo content has no button), that's expected — `--update` will reflect it.

---

## Follow-up 2 — Recover `packages/assets/` lost merge

### What's wrong

`packages/assets/src/index.ts` re-exports from these files that **don't exist on main**:

- `./canvas-processor.js` — browser-side `CanvasImageProcessor` (image pipeline)
- `./processor.js` — `ImageProcessor` interface
- `./pipeline.js` — `uploadAsset` / `deleteAsset` / `readAssetMetadata`
- `./mime.js` — image-mime allow-list
- `./hash.js` — content-addressed hashing

These were the deliverables of issue #8 (browser asset pipeline) → PR #54. Per the prior MERGE_HANDOFF.md, #54 was reported MERGED by GitHub but actually landed on a stacked base (`issue/7-editor-shell` or similar), not `main` — same lost-merge bug as #59.

The doc claimed #8 was "already recovered" via #74's scope-expansion (which it was, partially: #74 added `document-pipeline.ts` and `document-mime.ts` for the document side). But the IMAGE side was never recovered — `canvas-processor.ts`, `processor.ts`, `mime.ts`, `hash.ts`, and `pipeline.ts` are all still missing.

PR #75's rebase noticed this (the agent's report flagged "main's `packages/assets/src/index.ts` references files that do not exist on main yet"). #75 added `processor.ts` and `types.ts` from the Electron-side because the Electron pipeline reuses them. But the four files needed for the BROWSER side are still missing.

### Recovery: same approach as #59

The agent's commit on `origin/issue/8-asset-pipeline-browser` (or wherever the original work lives) has the missing files. Recovery options:

**Option A — cherry-pick onto a recovery branch** (cleanest, mirrors #59 recovery exactly):

```bash
cd "C:/Users/rdobr/Documents/anosr-site-builder"

# 1. Find the original commit that has the browser pipeline content.
#    The MERGE_HANDOFF.md said: "stacked branch origin/issue/8-asset-pipeline-browser"
#    Verify that branch still exists on remote:
git fetch origin
git ls-remote origin | grep issue/8

# 2. Inspect what's there:
git log origin/issue/8-asset-pipeline-browser --oneline -5

# 3. Find the canvas-processor commit. Likely the topmost (single) on the branch.
SHA_TO_RECOVER=<the SHA from step 2>

# 4. Create a recovery branch off main and cherry-pick:
git checkout -b issue-8-browser-pipeline-recovery main
git cherry-pick $SHA_TO_RECOVER

# 5. Resolve conflicts using the cookbook from the prior MERGE_HANDOFF:
#    - pnpm-lock.yaml: --ours, then `pnpm install`
#    - assets/src/index.ts: KEEP-BOTH-APPEND (main has document side from #74,
#      browser side adds canvas/mime/hash/pipeline)
#    - Anything in assets/test/: take theirs
#    - ADR collision: rename to docs/adr/0042-<keep-rest>.md (next free slot)

# 6. Push, open PR, merge:
git push -u origin issue-8-browser-pipeline-recovery
gh pr create --base main --title "Add browser asset pipeline: canvas + image processor (#8)" \
  --body "$(cat <<'EOF'
Recovers issue #8 (browser asset pipeline). The original PR #54 was
gh pr merge'd into a stacked base instead of main, so its content never
landed on main. Three of its files (canvas-processor, mime, hash, pipeline,
processor) are still missing on main and crashing transitive imports from
packages/assets/src/index.ts.

#74 (document pipeline) had partially scope-expanded the assets package
with document-side files. This PR completes the browser image side.

Closes #8.
EOF
)"

# 7. Verify mergeable, then squash-merge:
gh pr merge <N> --squash --delete-branch
```

**Option B — direct cherry-pick onto main** (faster but skips PR review):

```bash
git checkout main
git cherry-pick <SHA>
# resolve, run pnpm install, commit, push origin main
```

I used Option A for #59 (fresh PR, single commit on top of main, cleanest history). I'd repeat that here.

### Verify

After landing:

```bash
ls packages/assets/src/
# Should now have: canvas-processor.ts, document-mime.ts, document-pipeline.ts,
# document-types.ts, environment.ts, errors.ts, hash.ts, index.ts, mime.ts,
# pipeline.ts, processor.ts, sharp-processor.ts, types.ts, variant-pipeline.ts

cd "C:/Users/rdobr/Documents/anosr-site-builder"
pnpm install
npx vitest run packages/assets/
# Should be all green.
```

---

## Follow-up 3 — Stale bare ADR references (cosmetic)

### What's stale

After the ADR renumbering (`944bbec`), ~30 bare references in code comments still mention `ADR 0006` or `ADR 0007` even though the file they conceptually point to has moved:

- `packages/wizard/src/*.ts` — references `ADR 0007` for the wizard ADR (now at `0041`)
- `packages/renderer/src/blocks/embed.tsx` — references `ADR 0006` for embed privacy (now at `0039`)
- `packages/renderer/src/blocks/custom-html.tsx` — references `ADR 0006` for DOMPurify audit (now at `0038`)
- `packages/renderer/src/sanitize-config.ts` — references `ADR 0006` for markdown XSS-safety (now at `0034`)
- `docs/adr/0008-quote-block.md`, `docs/adr/0009-faq-block.md` — internal `ADR 0006` references
- ... and ~20 more

These are NOT broken file paths (since they don't include the filename). They're conceptual mentions like `// per ADR 0006`. They were deliberately left as-is during renumbering because the rule was "leave bare references; only update file-path references".

### Fix recipe (when motivated)

```bash
cd "C:/Users/rdobr/Documents/anosr-site-builder"

# Find every bare ADR NNNN reference that doesn't include a file path:
grep -rn "ADR 000[3-7]" --include="*.ts" --include="*.tsx" --include="*.md" --include="*.js" \
  | grep -v "docs/adr/000"   # exclude file-path refs (those were already updated)

# For each match, decide: which ADR was the author intending to reference?
# Look at surrounding context — `ADR 0006 (markdown sanitisation)` is unambiguous;
# bare `ADR 0006` may need to be inferred from the surrounding feature.
```

This is mechanical-but-judgement work — there's no automation that gets it right without reading the surrounding context for each reference. Skip until someone is bothered by it.

### Pre-existing typos (not from renumbering)

The renumbering agent noted two pre-existing reference typos that predate this orchestration:

- `docs/release-notes-37.md:84` references `0007-asset-pipeline-electron.md` (real file is `0031-asset-pipeline-electron.md`).
- `packages/renderer/README.md:69` references `0006-academic-theme-first-pass.md` (real file is `0024-academic-theme-first-pass.md`).

Both are in PR-authored content from before this session. Cheap to fix while you're in the area.

---

## Patterns confirmed by this session (worth re-using)

These supplement the prior MERGE_HANDOFF.md — same patterns held up under the second orchestration too.

### Lost-merge detection is non-optional

Always verify a "merged" PR's content is actually on main before treating it as landed:

```bash
# After any gh pr merge, check the squash commit is reachable from main:
git ls-tree origin/main packages/<expected-package>/<expected-file>
# vs.
git show <claimed-merge-sha> --stat
```

If the file isn't there, the PR landed on a stacked base. This bug bit #59, #62, #8 in the original orchestration; #8 partially survived through this session because nobody re-checked.

### `gh pr edit --base main` BEFORE merge, every time

Reflexive habit: any PR with a non-`main` base (visible in `gh pr list --json baseRefName`) gets retargeted _before_ `gh pr merge`. The agents in this session did this for all 16 PRs and zero new lost-merges occurred.

### Cookbook-driven parallel agents > free-form exploration

Pre-baking the conflict resolution rules ("registry files = keep both, append; goldens = `--ours`; lockfile = `--ours` + `pnpm install`") into agent prompts produced consistent, mergeable rebases across 14 parallel agent runs. Agents WITHOUT the cookbook would have re-derived the rule with varying interpretations.

### Pre-allocate ADR numbers per agent

Every parallel agent that "picks the next free ADR number" picks the same one. Pre-allocate per agent in the dispatch prompt. The original 6×0007 + 3×0006 + 2×0005 + 2×0003 collisions all came from this exact race.

### Re-rebase after each merge for shared-file PRs

After merging PR N, every other PR that touches the same files is now textually invalid even if their `mergeable` flag was CLEAN before the merge. Sequence merges from most-isolated → most-shared, and re-check `mergeable` between each. This session needed 4 re-rebases (one for #80, one for #82, one for #87, one for #75) — much better than re-rebasing all of them after every merge.

### Semantic merges sometimes need to override the cookbook

Three places this session: #84 civic vs editorial unified `emitTokenRoot` to accept BOTH `themeDefaults` (Record) AND `themeBaseline` (Array) instead of picking one; #87's `KNOWN_THEME_IDS` was expanded from `[STUB]` to all 6 themes for the per-theme axe gate to be meaningful; #75's `editor-app.tsx` integration of i18n hooks alongside multi-page+history+picker+validation. Pure "keep both, append" wouldn't have produced compiling code in any of these. Agents handled all three correctly when given enough context.

---

## When all three follow-ups are done

```bash
cd "C:/Users/rdobr/Documents/anosr-site-builder"

# Confirm CI green (no more demo-content / cta-banner / assets-imports failures):
pnpm test
# expect: 0 failed test files, 0 failed tests

# Optional: check there are no orphan branches lingering:
gh pr list --state all --limit 100 | head
git branch -a | grep -v -E "main|^\*" | head

# Delete this handoff:
rm MERGE_HANDOFF.md
```

If `pnpm test` is green at that point, the project is in the cleanest shape it has been in since #41 / #46.
