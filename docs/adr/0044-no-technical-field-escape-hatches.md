# 0044 — No technical-field escape hatches on round-trip

- **Status:** Accepted
- **Date:** 2026-05-11
- **Issue:** (TBD — invariant lands alongside ADR 0043's implementation work)

## Context

The editor targets non-technical users — small leadership teams in
Romanian student organisations (per README "Who it's for"), most of
whom rotate yearly and arrive at the tool with no prior context.

Several existing ADRs already encode pieces of a "no technical content
for end users" principle in isolation:

- **ADR 0027 (`DEPLOY.md` generator)** — exported zips include a
  `DEPLOY.md` walking a non-technical officer through deployment;
  the non-technical path comes first, the advanced path is footnoted.
- **ADR 0008 / 0014 / 0040** (block schemas with `AssetRef`s) — block
  schemas include `hash`, `mime`, `path`, `metadataPath`, `width`,
  `height` fields that the asset pipeline (`@sosb/assets`) populates;
  nothing in the ADRs says users _type_ these.
- **ADR 0019 (block library)** — block catalog with `mandatory` /
  `optional` / `advanced` categories, defaulting to a curated,
  non-technical surface.
- **ADR 0038 (custom HTML sanitization)** — the one block where
  pasting raw markup is acceptable carries an explicit advanced/danger
  marker; this is the _exception_, not the model.

But this principle has never been written down as a project invariant.
As a result, two concrete failure modes have already appeared:

1. The editor's auto-generated `SpineForm` renders a raw
   `<input type="text">` for `theme.id` (because the schema is
   `z.string().min(1)`), expecting the user to literally type
   `"academic"` or `"modern"`. The closed set of valid theme IDs is
   not surfaced.
2. The editor's auto-generated `BlockForm` renders text inputs for
   `AssetRef.hash`, `AssetRef.mime`, `AssetRef.path`, etc. — fields
   that have no meaning to a user and are produced exclusively by
   the asset pipeline. The block-defaults file even seeds the literal
   string `"hash": "placeholder"`, signalling that the codebase
   _expects_ a different UI (an "asset picker") to exist — but no
   such UI was built.

ADR 0043 builds the missing UI mechanism. This ADR consolidates the
underlying principle so future schema or feature changes don't
re-introduce the failure mode.

## Decision

**The editor never exposes pipeline-produced or programmer-facing
fields as user-editable inputs, in any flow, including degraded states
like import errors or schema mismatches.**

Three explicit corollaries:

### Corollary 1 — Round-trip invariant: zero re-uploads

A user who exports a site, sends the zip to a collaborator, and
re-imports it MUST encounter **zero "Upload" affordances for assets
already present in the zip**. The asset picker reads referenced
`AssetRef`s from the VFS and shows thumbnails directly. The zip
carries the binaries per ADR 0003; the import path already has every
asset addressable by hash.

The invariant is testable. The regression test is: import a known-good
zip, navigate to every asset-bearing block, count "Upload" affordances
rendered. The count must be 0.

### Corollary 2 — Missing-asset state is not a fallback to raw inputs

If, on import, an asset referenced in `data.json` is missing from the
zip's `assets/` folder, the asset picker renders a **"missing asset"**
affordance (offering re-upload to repair the broken reference). It
MUST NOT fall back to revealing the underlying `AssetRef` text inputs
as a "manual override" for power users.

The temptation to add a fallback ("just show the raw hash field so a
power user can hand-fix it") is rejected: there is no power-user
audience in scope for this tool. Power users can hand-edit `data.json`
in any text editor; they do not need editor support for it.

### Corollary 3 — Schema looseness is preserved by adding validation warnings, not by tightening parse

Some fields are deliberately loose at parse time for ADR 0002's
round-trip identity contract (`theme.id` is `z.string().min(1)` so a
snapshot carrying an unknown future-version theme survives a
read-write-read cycle byte-identically). For these fields the editor
side applies a three-part discipline:

- The schema stays loose (round-trip identity preserved).
- The per-field UI presents only the closed set (the theme picker
  offers only cataloged theme IDs; the user cannot enter an arbitrary
  string).
- Per-field validation emits a **warning**-tier issue (per ADR 0002's
  severity model) when the persisted value falls outside the closed
  set. Never an error that would fail parse.

The picker's read path tolerates the loose value (it renders a
humanised label for an unknown ID and offers the user the choice of
switching to a cataloged ID). The write path only persists cataloged
values.

## Rationale

- A scattered set of micro-decisions creates exactly the failure modes
  this ADR catches: a single new field added to a schema today causes
  the form-generator to render a new text input tomorrow, with nobody
  noticing it violates an unwritten principle. Writing the principle
  down makes the next "small" decision uphold it by default.
- The target audience under a power-user fallback doesn't grumble and
  use the tool anyway — they abandon it and use Linktree (per the
  PRD's problem statement). Compromising the principle to handle
  hypothetical edge cases erodes the actual case.
- The principle is **stricter than "hide advanced fields"** (ADR 0043's
  `tier:` mechanism). The "Show advanced" toggle reveals fields users
  _could_ legitimately edit but don't usually need to. This ADR puts
  a different category of field — pipeline-produced metadata — off
  limits entirely. There is no toggle that makes those fields
  appropriate user-facing surfaces.

## Consequences

- The asset picker and theme picker (planned, per CONTEXT.md, designed
  in ADR 0043) are not optional polish — they're **required** by this
  invariant. The current auto-generated text inputs for `AssetRef`
  fields and for `theme.id` are bugs against this ADR, not just rough
  edges.
- Any future block with pipeline-produced fields (a new asset variant,
  a new pipeline-side fingerprint, etc.) MUST land alongside its
  picker UI. Landing the schema without the picker is a regression
  against this ADR.
- The schema validation layer gains warning-tier rules for closed-set
  loose fields. The first such rule is `theme.id`; future closed-set
  fields land their own rules in `packages/schema/src/validate.ts`.
- A round-trip regression test (Corollary 1 above) is added to the
  e2e suite alongside the existing export/import tests.
- The "Show advanced" toggle (ADR 0043) MUST NOT be repurposed as a
  home for fields this ADR puts off-limits. Reviewers should reject
  PRs that attempt to expose `hash` / `mime` / `path` / etc. behind
  the advanced toggle.

## Alternatives considered

- **Per-feature ADRs**: write a separate ADR for the asset picker,
  another for the theme picker, etc. Rejected: each ADR would
  re-litigate the same principle. Consolidating it once and citing it
  from feature ADRs keeps the rationale single-source.
- **A "power user mode" preference** revealing the raw inputs for
  users who want them. Rejected: no such user exists in the target
  audience, and the toggle becomes a foot-gun that erodes the
  invariant over time. Power users have `data.json` and any text
  editor.
- **Tighten all closed-set schemas to enums** for stricter compile and
  parse guarantees. Rejected: breaks ADR 0002's round-trip identity
  for unknown future-version values. Warning-tier validation gives
  the same UX without the parse-failure regression.
- **A lighter "soft warning" instead of an invariant**: just label the
  raw inputs better and hope users figure it out. Rejected: even
  perfectly labelled, a `mime` text input is a wrong-tool-for-the-job
  surface for this audience. The principle isn't about labelling, it's
  about which fields exist as user-facing inputs at all.

## Out of scope

- Specific picker UI designs (covered by ADR 0043 and follow-up
  implementation issues).
- The wizard's bespoke happy-path flow (ADR 0041), which already
  follows this principle by construction — it doesn't expose pipeline
  fields because it doesn't auto-generate forms from schemas.
- Custom HTML's `sanitize: false` toggle (ADR 0038) — that is a
  _user-facing risk-acceptance_ case (the user is deliberately opting
  into raw HTML), not a _pipeline-metadata_ case. The danger marker
  there is the right surface for that decision; this ADR does not
  apply.
