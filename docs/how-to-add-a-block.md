# How to add a block

This is the contributor walkthrough for adding a new block type to the
Student Org Site Builder. It uses the **hero block** as the canonical
worked example, because (a) it is the only block in the registry today
and (b) it covers every layer a real block touches: schema, renderer,
editor metadata, defaults, tests, and the golden-file matrix.

> Audience: someone implementing one of issues #9–#22 (the v1 block
> matrix), or anyone proposing a new block type after v1.

## Prerequisites

Read the following before opening a block-implementation PR:

- [`docs/PRD.md`](PRD.md) — especially the "Implementation Decisions →
  Data & schema" and "User Stories → Content authoring — blocks"
  sections. The PRD pins the v1 block list and several cross-cutting
  policies (preserve-unknown-keys, severity-tiered validation, a11y,
  no-framework-in-output).
- [ADR 0002 — Schema library and validation model](adr/0002-schema-library-and-validation-model.md) —
  why blocks are described as Zod `looseObject`s, how severity tiers
  work, and the round-trip identity contract.
- [ADR 0032 — Renderer skeleton, tokens, determinism](adr/0032-renderer-skeleton-and-determinism.md) —
  the renderer's purity guarantees, how tokens flow, the golden-file
  framework, and the no-runtime-in-output contract.
- [ADR 0008 — Block library picker, DnD, undo](adr/0008-block-library-dnd-and-undo.md) —
  how the editor's block catalog is **derived dynamically** from the
  schema registry, so a new block surfaces in the picker as soon as it
  lands in `KnownBlockSchemas` (with metadata as a separate, additive
  layer).

## Mental model

Every block is a serialisable record with the envelope:

```ts
{ id: string, type: string, version: number, data: { ... } }
```

The PRD pins this envelope. `data` is per-type and grows over time —
schemas are **additive within v1.x** and unknown fields are preserved
on round-trip. New blocks land as new entries in the schema's
`KnownBlockSchemas` registry; the editor's catalog and the renderer's
dispatch table both look the type up there.

The block touches five layers, in this order:

1. **Schema** (`@sosb/schema`) — the source of truth. Defines the
   data shape, the version, validation, and any quality-warning rules.
2. **Renderer** (`@sosb/renderer`) — a pure Preact component that
   takes the validated block and returns structural HTML (no design
   opinions).
3. **Editor metadata** (`@sosb/editor-app`) — catalog entry (label /
   description / category) and a default-data factory used by the
   "Add block" dialog.
4. **Editor form** (`@sosb/editor-app`) — typically auto-generated
   from the schema by the form-generator (#7); blocks with unusual
   needs may add a hand-coded form. Forms for the v1 matrix are
   tracked per-block in the issue backlog.
5. **Tests + golden file** — unit tests for the schema and renderer,
   plus a row in the `(blocks × themes)` golden-file matrix
   asserting deterministic output.

The hero block is the smallest example that exercises all five.

## Step 1 — Schema entry

Add the schema under `packages/schema/src/blocks/<type>.ts`:

```ts
// packages/schema/src/blocks/hero.ts
import { z } from "zod";

export const HeroDataSchema = z.looseObject({
  eyebrow: z.string().optional(),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  backgroundImage: z.string().optional(),
  backgroundAlt: z.string().optional(),
});

export const HeroBlockSchema = z.looseObject({
  id: z.string().min(1),
  type: z.literal("hero"),
  version: z.literal(1),
  data: HeroDataSchema,
});

export const HERO_BLOCK_VERSION = 1 as const;

export type HeroBlock = z.infer<typeof HeroBlockSchema>;
export type HeroData = z.infer<typeof HeroDataSchema>;
```

Notes:

- **Use `z.looseObject`**, not `z.object`. Loose objects preserve
  unknown keys on the persistence boundary, which is the v1 forward-
  compatibility contract (ADR 0002). Stripping unknown keys would
  break round-trip identity for sites authored on a newer editor.
- **`type: z.literal(<type-string>)`** and **`version: z.literal(N)`**.
  These literals are what `validateBlock` uses to look the block up
  in the registry.
- **Required fields are minimal.** The hero only requires
  `data.title.min(1)`. Everything else is optional. This is
  intentional: schema errors are blocking-on-confirmation per the
  severity model, so over-zealous required fields create friction
  without improving output quality. Quality nudges go in `validate`
  as warnings, not as schema requirements.
- **Derive types via `z.infer`.** Never write a hand-maintained type
  alias next to the schema — it will drift.
- **Export a `<TYPE>_BLOCK_VERSION` constant.** The default-builder
  table and migration framework consume this.

Then register the block in `packages/schema/src/blocks/index.ts`:

```ts
import { HeroBlockSchema } from "./hero.js";
// ...other imports...

export const KnownBlockSchemas = {
  hero: HeroBlockSchema,
  // <new-block>: <NewBlockSchema>,
} as const;
```

…and re-export from `packages/schema/src/index.ts` so consumers
don't have to reach into the package's internals:

```ts
export {
  HERO_BLOCK_VERSION,
  HeroBlockSchema,
  HeroDataSchema,
  // ...new exports...
} from "./blocks/index.js";
export type { HeroBlock, HeroData /* ...new types... */ } from "./blocks/index.js";
```

### Quality warnings

The PRD's severity model (ADR 0002) layers **warnings** on top of
schema parsing. They live in `packages/schema/src/validate.ts`.
For the hero, the rule is: a hero with a `backgroundImage` but no
`backgroundAlt` should warn. Add the rule next to the existing ones:

```ts
// inside validate(data) — runs only if the schema parse succeeded
if (block.type === "hero" && block.data.backgroundImage && !block.data.backgroundAlt) {
  result.warnings.push({
    severity: "warning",
    path: ["pages", pageIndex, "blocks", blockIndex, "data", "backgroundAlt"],
    code: "block.hero.backgroundAlt.missing",
    message: "Hero background image has no alt text — set one for accessibility.",
  });
}
```

The hero block test suite (`packages/schema/test/hero-block.test.ts`)
asserts both the schema verdicts and this specific warning rule.

## Step 2 — Renderer component

Add a Preact component under
`packages/renderer/src/blocks/<type>.tsx`:

```tsx
// packages/renderer/src/blocks/hero.tsx
/** @jsxImportSource preact */
import type { HeroBlock } from "@sosb/schema";

export function Hero(props: { block: HeroBlock }): preact.JSX.Element {
  const { id, data } = props.block;
  const eyebrow = typeof data.eyebrow === "string" ? data.eyebrow : undefined;
  const title = data.title;
  const subtitle = typeof data.subtitle === "string" ? data.subtitle : undefined;
  const backgroundImage =
    typeof data.backgroundImage === "string" ? data.backgroundImage : undefined;
  const backgroundAlt = typeof data.backgroundAlt === "string" ? data.backgroundAlt : "";

  return (
    <section data-block="hero" data-block-id={id} aria-labelledby={`${id}__title`}>
      <div class="hero__inner">
        {eyebrow !== undefined && <p class="hero__eyebrow">{eyebrow}</p>}
        <h1 id={`${id}__title`} class="hero__title">
          {title}
        </h1>
        {subtitle !== undefined && <p class="hero__subtitle">{subtitle}</p>}
        {backgroundImage !== undefined && (
          <div class="hero__media">
            <img src={backgroundImage} alt={backgroundAlt} loading="lazy" />
          </div>
        )}
      </div>
    </section>
  );
}
```

Hard rules from ADR 0003:

- **Pure data-in / string-out.** No `Date.now()`, `Math.random()`,
  `crypto.randomUUID()`, `performance.now()`. No environment globals
  (`document`, `window`, `process`, `Buffer`). The same code runs in
  Node and browser and must produce byte-identical output.
- **Tolerant field reads.** Even though the schema typed the data,
  the renderer is on the receiving end of preserve-unknown-keys
  round-trips: a future field added in #26 will reach this component
  before the type is widened. Defensive `typeof === "string"` checks
  are the convention.
- **Semantic structure first, design second.** Themes own the visual
  treatment via tokens-as-CSS-variables. The component sets only the
  semantic / a11y shape: `<section>` with `data-block`,
  `aria-labelledby`, semantic heading levels, alt text, lazy loading
  for images.
- **No raw colours.** Any per-block CSS the theme adds for this
  block's `data-block="<type>"` selector must reference
  `var(--token-...)`, never literal hex / rgb. The accessibility test
  suite asserts this.
- **Per-theme variants only when needed.** The PRD says blocks with
  meaningful per-theme layout differences (e.g. team grid layouts)
  get per-theme variants under `@sosb/themes`; blocks like the hero
  share one structural component across themes.

Then dispatch to it from `renderSite` / `PageShell`. The current
`page-shell.tsx` already handles known-vs-unknown dispatch; new
blocks just need a case in the dispatch switch (see the file for
the canonical pattern). Unknown block types fall through to
`<!-- unknown block: <type> -->` HTML comments per the
preserve-unknown-keys policy.

### Multi-parent setup for image-bearing blocks (#11, #12, …)

Blocks that carry assets — `image`, `gallery`, hero with a
`backgroundImage`, partner-logos, documents, etc. — depend on the
asset pipeline (`@sosb/assets`) to produce the right `src` URL.
Their PRs merge two parent branches:

1. **The schema parent** — the issue that adds the block's schema
   entry (a sibling of #9–#22 owned by that block).
2. **The asset-pipeline parent** — the issue that owns the image
   processing pipeline (`@sosb/assets`, #8). The asset pipeline
   produces the content-addressed `assets/<hash>.<ext>` paths the
   block's schema field references.

The branch that lands the block's renderer + tests is created from
`main` after both parents have merged, so its diff against `main`
contains only the block-specific work — schema, renderer, tests,
golden file. If you need to integrate before both parents have
landed, create the block branch from the later parent and document
the merge order in the PR body. Issues #11 and #12 are the
canonical examples of this pattern.

This is the same multi-parent pattern used by the editor-shell
issue (#7), which depended on both `@sosb/vfs` (#6) and the schema
(#3); see the `git log --graph` for `1112ed2` for the merge shape.

## Step 3 — Editor catalog metadata

`@sosb/editor-app` derives the "Add block" dialog dynamically from
`KnownBlockSchemas`, so your block already appears in the picker
the moment the schema export lands. Per ADR 0008 you still want
to provide explicit metadata so the dialog shows a polished label
and category instead of the humanised fallback.

Edit `packages/editor-app/src/block-catalog.ts`:

```ts
const BLOCK_METADATA: Record<
  string,
  { readonly category: BlockCategory; readonly label: string; readonly description: string }
> = {
  hero: {
    category: "mandatory",
    label: "Hero",
    description: "Page-opening title, subtitle, and optional background image.",
  },
  // <new-type>: { category, label, description },
};
```

Categories are `"mandatory" | "optional" | "advanced"`. The PRD's
user story 37 pins the three-bucket categorisation; pick the bucket
that matches the block's intended role. Mandatory ⇒ hero. Optional
⇒ the bulk of v1 blocks. Advanced ⇒ custom-HTML, embeds, anything
with footguns.

## Step 4 — Default-data factory

When the user picks a block in the dialog, the editor inserts a
fresh envelope built by `defaultBlockFor(type)`. Add a default for
your type in `packages/editor-app/src/block-defaults.ts`:

```ts
const DEFAULT_BUILDERS: Record<string, DefaultBuilder> = {
  hero: {
    version: HERO_BLOCK_VERSION,
    data: () => ({ title: "New page" }),
  },
  // <new-type>: { version: <TYPE>_BLOCK_VERSION, data: () => ({ ...minimal valid data... }) },
};
```

The default must be a value that **passes the schema parse** so the
user lands on a working block, not a half-shaped one. Aim for the
smallest valid shape — fields the user is expected to immediately
edit (titles, headings) get clear placeholder copy; optional
fields stay omitted.

## Step 5 — Editor form

Most blocks get their per-block form auto-generated from the schema
by the form-generator landed in #7
(`packages/editor-app/src/form-generator.ts`). The generator walks
the Zod schema's `def.type` strings and emits one input per leaf
field; optional / nullable wrappers become per-field "optional"
flags (ADR 0005). New blocks usually need **no form code at all**
— the auto-generated form covers strings, numbers, booleans, enums,
and nested objects out of the box.

Hand-coded forms are reserved for blocks with truly unusual UX:
the gallery (drag-reorderable items), the FAQ (variable-length
items), the team block (grouped lists), the embed block (provider
whitelist UI). When those land they will document their patterns;
v1 blocks should default to the auto-generated form unless their
issue body says otherwise.

## Step 6 — Tests

Three layers of tests, all required.

### a) Schema tests — `packages/schema/test/<type>-block.test.ts`

Cover, at minimum:

- A well-formed block parses.
- A block with all optional fields populated parses.
- Each required field's absence is rejected.
- Each required field's empty value is rejected (e.g. empty
  string for the title).
- A block with the wrong `type` literal is rejected.
- `validateBlock` returns severity-tiered issues for malformed
  input.
- Each warning rule (e.g. missing `backgroundAlt` when a
  `backgroundImage` is set) fires as a `warning`, not as an
  `error`.

The hero suite at `packages/schema/test/hero-block.test.ts` is the
template — copy its shape.

### b) Renderer tests — `packages/renderer/test/`

The renderer has cross-block tests already (`render-site.test.ts`,
`accessibility.test.ts`, `parity-jsdom.test.ts`); a new block
plugs into them via the page-shell dispatch. If the block has
behaviour beyond rendering text + media — anchors, interactivity,
unusual ARIA — add a focused test for it. The accessibility test
asserts axe-clean output across the matrix; new blocks must pass
without exceptions.

### c) Golden file — `packages/renderer/test/__golden__/<theme>-<block>.html`

Every `(block × theme)` pair gets a row in the matrix. The hero
example lives at
`packages/renderer/test/__golden__/stub-theme-hero.html`. The test
that writes / diffs it is in
`packages/renderer/test/golden-file.test.ts`:

```ts
test("hero-only stub-theme render matches its golden file", async () => {
  const html = renderSite(fixture, "stub");
  await expect(html).toMatchFileSnapshot("__golden__/stub-theme-hero.html");
});
```

Workflow:

1. Add a fixture under `packages/renderer/test/fixtures/<block>-only.json`
   with a single page containing only your block (and the
   block-envelope hero if your block isn't itself the hero — every
   page begins with a hero per the PRD).
2. Add a test that calls `renderSite(fixture, "<theme-id>")` and
   asserts `toMatchFileSnapshot("__golden__/<theme>-<block>.html")`.
3. Run the test once. Vitest writes the golden file on first run
   and diffs against it on every subsequent run. Inspect the
   generated HTML manually before committing — the file is a
   regression baseline, so its initial state must be correct.
4. The matrix grows as themes land (#28–#31, #47). When a new
   theme PR adds a row for your block, it adds the matching
   golden file, not you.

The `__golden__` directory is in `.prettierignore` because
reformatting it would invalidate the byte-exact contract.

### Round-trip identity

Schema additions automatically inherit the round-trip identity test
under `packages/schema/test/preserve-unknown.test.ts`: parse a
fixture with extra fields, re-serialise, deep-equal. If your block
adds a new field shape (e.g. an array of items), extend the
fixture there as well so the round-trip cycle covers it.

## Step 7 — Documentation hooks

- Update the package's `README.md` if you've added a public-API
  surface (new exported types, new helpers).
- If the block introduces a non-trivial design choice — a new
  field shape, a tricky a11y pattern, an interactive layer — write
  a short ADR alongside the implementation PR. See
  [CONTRIBUTING.md → How to add an ADR](../CONTRIBUTING.md#how-to-add-an-adr).
- Cross-reference the block's user story in the PRD by number when
  you commit (e.g. `Add hero block (PRD US 20, #9)`).

## Step 8 — Verify

Before opening the PR:

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm -r --filter @sosb/schema run test
pnpm -r --filter @sosb/renderer run test
pnpm build
# If your block crosses package boundaries (e.g. the editor catalog or
# defaults), also run:
pnpm test:e2e
```

All commands must exit 0. Any non-determinism in the renderer
(seen as a flaky golden-file diff) is a bug, not a test problem —
trace it back through the parity test in
`packages/renderer/test/parity-jsdom.test.ts` and fix the source
of the drift, not the test.

## Checklist

When you're ready to send the PR, walk through this list:

- [ ] Schema entry under `packages/schema/src/blocks/<type>.ts`,
      using `z.looseObject`, with derived types via `z.infer`.
- [ ] Type registered in `KnownBlockSchemas` and re-exported from
      `packages/schema/src/index.ts`.
- [ ] Quality-warning rule in `packages/schema/src/validate.ts`
      (when applicable).
- [ ] Renderer component under
      `packages/renderer/src/blocks/<type>.tsx`, pure and
      determinism-clean.
- [ ] Page-shell dispatch wires the new component.
- [ ] Editor catalog metadata in
      `packages/editor-app/src/block-catalog.ts`.
- [ ] Default-data builder in
      `packages/editor-app/src/block-defaults.ts`.
- [ ] Schema unit tests (well-formed / required-missing /
      severity-tiered).
- [ ] Golden-file row added under
      `packages/renderer/test/__golden__/`, with a fixture
      under `packages/renderer/test/fixtures/`.
- [ ] Round-trip identity test extended if the block adds a new
      field shape.
- [ ] Multi-parent merge documented in the PR body for image-
      bearing blocks (#11/#12/etc.).
- [ ] All four CI jobs pass locally: `typecheck`, `lint`,
      `test`, `build`.
- [ ] PR body uses the [pull request template](../.github/PULL_REQUEST_TEMPLATE.md)
      and links the issue with `Closes #<n>`.
