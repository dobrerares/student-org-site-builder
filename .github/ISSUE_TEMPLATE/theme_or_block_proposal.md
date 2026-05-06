---
name: Theme or block proposal
about: Propose a new theme or a new block type beyond the v1 set.
title: "Proposal: <theme | block> — <name>"
labels: ["needs-triage"]
assignees: []
---

<!--
The v1 PRD pins the block matrix (15 blocks) and the theme matrix (5
themes: Academic, Modern, Editorial, Civic, Minimal). New themes or blocks
beyond that set are post-v1 work; this template captures them so they
don't get lost.

If you're proposing an *implementation* of an existing PRD block or theme,
please use the standard feature-request template and link the PRD section.
-->

## Type

- [ ] New block
- [ ] New theme
- [ ] Variant of an existing block / theme

## Proposal name

<!-- e.g. "Calendar block", "Brutalist theme". -->

## What it is

<!-- One paragraph: what does this block / theme look like, and what user
problem does it solve? Link example student-org sites that use a similar
pattern. -->

## Why it earns its place

<!-- The PRD intentionally keeps the matrix small. Make the case for
inclusion: which existing blocks/themes can't cover this need, and how
common is the use case across student orgs? -->

## Schema sketch (block proposals only)

<!-- See `docs/how-to-add-a-block.md`. A new block needs:
- A schema entry in `@sosb/schema` (Zod looseObject).
- A `version: 1` literal.
- A renderer component in `@sosb/renderer`.
- Optional editor-form metadata + defaults in `@sosb/editor-app`.
- Tests + a golden file row in the renderer's matrix.

Sketch the schema fields below. -->

```ts
// example
export const ProposedBlockDataSchema = z.looseObject({
  // ...fields...
});
```

## Visual sketch (theme proposals only)

<!-- Link a Figma file or attach screenshots. The PRD's "Theme & visual
customization" section pins the token surface — your theme should override
those tokens, not introduce new schema fields. -->

## Accessibility considerations

<!-- WCAG 2.2 AA is non-negotiable. Note any contrast / motion / keyboard
considerations you've already thought through. -->

## Out of scope

<!-- What this proposal explicitly does *not* include. -->
