# 0006 — eventList block, ISO datetime contract, and vanilla-JS past-fade

- **Status:** Accepted
- **Date:** 2026-05-05
- **Issue:** #22

## Context

Issue #22 asks for the `eventList` block: a list of single-occurrence
events (title, datetime, optional description / image / location / url),
sorted by date, with three configurable behaviours for events whose start
has passed: `show` (no de-emphasis), `fade` (visually muted), and `hide`
(removed from view). The PRD (Implementation Decisions → Block library)
pins the broad strokes:

- single occurrences only — no recurring rules, no `.ics` export in v1,
- site-wide timezone (Europe/Bucharest) with no per-event override,
- past-fade is **client-side**, not baked into the build output,
- the past-fade script is part of the ≤10kb vanilla JS budget for
  interactive blocks, with a sub-budget of <1.5kb for this block alone,
- axe-core clean output.

The PRD does **not** pin:

- the exact ISO 8601 contract on `startsAt` / `endsAt` (with-offset?
  UTC-only? naive local time?),
- where the past-fade script lives in the package graph,
- how the script is shipped (bundled? inlined? external `.js`?),
- the markup contract between the renderer and the script,
- how renderer-determinism is preserved given that "now" must be read at
  runtime.

This ADR records those choices.

## Decision

### ISO 8601 datetimes carry a mandatory timezone designator

`EventEntrySchema.startsAt` and `EventEntrySchema.endsAt` (when present)
must be ISO 8601 strings ending in either `Z` (UTC) or a numeric offset
(`+03:00`, `-05:00`). A naive local-time string like
`2026-06-15T18:00:00` is rejected by the schema.

The constraint is enforced via a regex (rather than `z.string().datetime()`
or a `refine` that calls `Date.parse`) for two reasons:

1. `Date.parse` accepts a wide variety of historical formats (`"Jan 1 2020"`,
   RFC 2822, etc.) — too lax for our load-bearing AC. The regex narrows the
   accepted shape to exactly what the past-fade script can rely on.
2. The regex is the one place that documents the contract. Future block
   schemas with datetime fields can import or duplicate the same pattern.

Why the offset is mandatory:

- The build output is **deterministic** (ADRs 0003, 0004) — no `Date.now()`
  at render time, no environment-dependent string production. The script
  consumer reads `Date.now()` at the visitor's browser, which gives an
  absolute UTC milliseconds value.
- A naive local-time `startsAt` would be ambiguous: a visitor in
  `Europe/Bucharest` and one in `America/Chicago` would compute different
  past-vs-future verdicts for the same string. The PRD's
  one-timezone-per-site v1 policy is preserved by **putting the timezone
  on the data**, not on the rendering environment.
- This makes the contract round-trippable: a HISTORIPOL site exported in
  Bucharest, edited in Iași, and viewed from London produces the same
  past-vs-future verdict on every visitor's machine.

Rejected alternatives:

- **Use `z.string().datetime()` (Zod's built-in)** — Zod's `datetime()`
  enforces ISO 8601, but its default mode allows a trailing `Z` only;
  we want both `Z` and numeric offsets, and the regex is easier to grep
  / point at than nested Zod options.
- **Accept naive local-time strings and re-interpret them site-wide as
  Europe/Bucharest**. Drags in `Intl.DateTimeFormat` / IANA tzdata
  reasoning at the visitor's machine and exposes the editor user to a
  "you said 6pm but it rendered as 8pm" trap when their machine clock
  sat in a different zone. Putting the offset on the data is cleaner.
- **Accept Unix-epoch seconds.** Loses human readability in `data.json`
  and the `<time datetime="…">` semantic markup the renderer wants.

### Renderer is deterministic; "now" lives at the visitor's browser

The renderer:

- sorts the events at render time (`Date.parse` on the offset-bearing
  `startsAt`, lexicographic fallback for malformed dates kept as a
  defensive measure since `looseObject` lets unknown shapes through),
- emits one `<article data-event-id data-starts-at [data-ends-at]>` per
  entry, with a machine-readable `<time datetime="…">` child,
- emits `data-past-behavior="show|fade|hide"` on the
  `<section data-block="event-list">` wrapper,
- never calls `Date.now()`, `Math.random()`, or any non-deterministic
  source.

The build output therefore has the same byte sequence on every machine
and at every clock time; ADRs 0003 + 0004's determinism contracts are
preserved.

### Past-fade script is a string constant inlined in the page-shell

The script is exported from
`packages/renderer/src/blocks/event-list-past-fade.ts` as the
compile-time constant `EVENT_LIST_PAST_FADE_SCRIPT`. The page-shell
inlines it as a single
`<script data-sosb="event-list-past-fade">…</script>` at end of `<body>`,
**only when at least one eventList block is present on the page**.

Three load-bearing properties of this choice:

1. **Pages without event lists ship zero JS.** The PRD's "static HTML +
   ≤10kb vanilla JS only when interactive blocks are present" contract
   is honoured page-by-page, not site-wide.
2. **The script is hand-written and minimal** (under 1500 raw bytes —
   well under the 1.5kb minified budget). No bundler, no minifier, no
   sourcemap. This eliminates a build-time tooling surface and makes
   the shipped bytes transparent in PR review.
3. **The script source is a renderer-owned compile-time constant**, not
   user data. The page-shell's existing security note records the
   rationale for each inline-HTML site already.

Rejected alternatives:

- **Bundle the script via esbuild and emit it as `assets/sosb-runtime.js`**.
  Adds a bundler step to the renderer (which currently has none — see
  ADR 0003), couples the renderer to the build pipeline's asset model
  (#8), and requires a `<script src=…>` tag instead of inline. The
  inlined-string approach is strictly simpler at our 1.5kb scale.
- **Inline the script in the iframe preview only** (skip it on built
  sites). Breaks the "iframe and built site share the same HTML" AC
  from ADR 0005 and means published HTML has no past-fade behaviour.
- **Run past-fade as a Preact mount on hydration**. Drags a Preact
  runtime into shipped sites — explicitly forbidden by ADR 0003 and
  the PRD.

### Markup contract between renderer and script

The script reads only data attributes — it never inspects the DOM
structure beyond `[data-block="event-list"]` → `[data-event-id]`. This
keeps the contract narrow:

| Attribute on `<section data-block="event-list">` | Meaning                                                               |
| ------------------------------------------------ | --------------------------------------------------------------------- |
| `data-past-behavior="show"`                      | Skip; do nothing per event.                                           |
| `data-past-behavior="fade"`                      | Add `is-past` class to past events.                                   |
| `data-past-behavior="hide"`                      | Remove past events from the DOM.                                      |
| (omitted)                                        | Treated as `"fade"` (the renderer always emits a value, defensively). |

| Attribute on `<article data-event-id>` | Meaning                                                  |
| -------------------------------------- | -------------------------------------------------------- |
| `data-starts-at="<ISO with offset>"`   | Required. Event start instant.                           |
| `data-ends-at="<ISO with offset>"`     | Optional. If present, event is past once `endsAt ≤ now`. |
| (otherwise)                            | Past once `startsAt ≤ now`.                              |

The script reads `Date.now()` once at the start of its run so every event
in every block is compared against the same instant, regardless of how
long the loop takes. Unparseable timestamps short-circuit defensively
(the entry is left as-is rather than thrown out) — the schema's regex
prevents this case in well-formed sites, but a stale page surviving a
stricter schema upgrade would otherwise crash the script.

### `endsAt` semantics

An event whose `startsAt` is in the past but whose `endsAt` is in the
future is **ongoing**, not past. The script honours this — it only
flags / hides events whose `endsAt` (when present) or `startsAt` (when
no `endsAt`) is at-or-before `now`. The visitor sees an in-progress
event as upcoming until it actually ends.

### Sort happens at render time, never re-sorts at runtime

`sortBy` (defaults to `date-asc`) is consumed by the renderer; the
script never re-orders the DOM. Two reasons:

1. **Determinism** — the build output's source order is the order the
   user (or schema validator) sees in the test fixtures. A second
   client-side sort would diverge from the snapshot/golden output.
2. **Performance** — re-sorting hundreds of events per page-load is
   wasted work for the majority of sites that ship handfuls.

If a future requirement needs runtime re-sorting (e.g. "show upcoming
first, push past to bottom"), the script can layer the behaviour on
without changing the markup contract.

### Default values

| Field          | Default    | Where the default is applied        |
| -------------- | ---------- | ----------------------------------- |
| `sortBy`       | `date-asc` | Renderer (`DEFAULT_EVENT_SORT`).    |
| `pastBehavior` | `fade`     | Renderer (`DEFAULT_PAST_BEHAVIOR`). |

Both defaults live as exported constants in `@sosb/schema` so the editor
form (owned by #9–#22's editor work) and the renderer agree on the value
without two sources of truth.

## Rationale

The most subtle requirement is "deterministic build + correct
past-vs-future at render time, with no per-event timezone override."
The honest answer is that the timezone has to live somewhere with the
data. Once it lives in `startsAt`, `Date.parse` is enough — no IANA
tzdata, no `Intl.DateTimeFormat`, no per-visitor reasoning. The script
is therefore trivially small and trivially testable.

The script-as-string-constant choice trades a tiny amount of build
ergonomics (no bundling, no minification) for a large amount of
audit-ability — the bytes that ship to visitors are visible in
`packages/renderer/src/blocks/event-list-past-fade.ts`. This matches
the project's privacy-first stance ("you can read every byte the
visitor runs").

## Consequences

- `packages/schema` gains an `EventListBlockSchema` that mirrors hero's
  shape (`looseObject` everywhere, version literal). The validator's
  `runBlockRules` switch had to drop its TS exhaustiveness assertion
  because Zod 4's `looseObject` adds an index signature that prevents
  strict narrowing — a tag-based `if`/`return` chain is what the
  codebase uses now. Future blocks add their own
  `if (block.type === "X")` branch.
- `packages/renderer` gains an `EventList` block component, a
  `EVENT_LIST_PAST_FADE_SCRIPT` constant, and a per-block CSS rule set
  in the stub theme. The page-shell sniffs for at least one eventList
  block and conditionally emits the past-fade `<script>`.
- The stub-theme golden file and the build pipeline's two snapshots
  pick up the additional CSS bytes (the eventList rules) — a one-time
  snapshot update, no behavioural impact.
- The browser-runnability guard (no `node:` imports in the build's
  bundle) still passes; the renderer module never touches Node
  built-ins, and the past-fade script consumes only browser DOM APIs.
- Adding future block types (#9–#22) follows the same recipe: add a
  schema mirroring hero/eventList, add a renderer component, branch in
  page-shell's `renderBlock`. Per-block scripts (when needed) live next
  to their renderer file the way past-fade does.

## Alternatives considered

- **Build-time sort + runtime sort** — strictly equivalent for sorted
  inputs, but the runtime sort would need to read `Date.now()` to
  decide where to break ties between past-and-future, which the
  build-time sort sidesteps entirely.
- **Per-event timezone overrides** — explicitly out of scope for v1.
  Adding a `timezone: string` field to `EventEntrySchema` would force
  the script to load tzdata to compute "is `2026-06-15T18:00:00` in
  `Europe/Bucharest` ≤ now?". A future v1.x can add this additively
  without breaking the offset-bearing default.
- **Fancy past-styling rules** (per-event `pastBehavior`, time-since-now
  formatting, "Today" / "Tomorrow" labels) — none asked for by #22;
  all are additive future work.

## Out of scope

- iCal / `.ics` export and recurring-event rules (RRULE) — explicit
  PRD non-goals for v1.
- Per-event timezone overrides — site-wide-timezone v1 contract.
- Server-side filtering, search, category tabs — issue scope is "list
  - past-fade", not "calendar app".
- Theme-specific eventList layouts (Academic / Civic / etc.) — owned
  by #28–#31, #47.
- The editor's per-block form for eventList — auto-generated from the
  schema by the form generator (#7-related, but the actual form
  arrives with the block-form work in #9–#22).
