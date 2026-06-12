# Form Overrides + Asset/Theme Pickers Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the editor friendly to non-technical Romanian student-org leaders by (a) replacing hash/mime/path text inputs with an upload-only asset picker, (b) replacing the `theme.id` text input with a theme picker in a dedicated theme drill-in, (c) hiding 4 power-user fields behind a per-form "Show advanced" toggle, and (d) rewriting jargon labels (`alt` → "Image description (for screen readers)", etc.).

**Architecture:** Per ADR 0043, layered overrides — schema-identity dispatch in `form-generator.ts` for canonical structural overrides (`AssetRefSchema`, `DocumentRefSchema`), plus a side-table `field-metadata.ts` for label/`tier:`/non-canonical-renderer overrides. Per ADR 0044, no field ever falls back to a raw text input on any code path (round-trip is zero-re-upload).

**Tech Stack:** Preact 10, Zod 4, vitest + jsdom for unit/component tests, Playwright for e2e. Workspace monorepo using pnpm. Existing asset pipeline in `@sosb/assets` is already wired and unused — this plan wires it to UI.

**Reference reading before starting:**

- `CONTEXT.md` — glossary terms used throughout (`Site spine`, `BlockForm`, `Theme catalog`, `Asset picker`, `"Show advanced" toggle`, `Field-override metadata`)
- `docs/adr/0043-form-override-architecture.md` — the mechanism
- `docs/adr/0044-no-technical-field-escape-hatches.md` — the invariant
- `docs/adr/0019-block-library-dnd-and-undo.md` — `block-catalog.ts` precedent (this plan mirrors it for the theme catalog)
- `docs/adr/0042-editor-pane-drill-in-pattern.md` — DrillMode pattern (this plan adds a 4th case)
- `packages/editor-app/src/form-generator.ts` — the walker being extended
- `packages/editor-app/src/block-catalog.ts` — the file to mirror

**Phases:**

| Phase                      | What                                             | Tasks   | Dependencies                       |
| -------------------------- | ------------------------------------------------ | ------- | ---------------------------------- |
| **1. Foundation tracer**   | Theme picker end-to-end                          | T1-T8   | None                               |
| **2. Asset picker tracer** | Schema-identity dispatch for `AssetRef`          | T9-T12  | Phase 1 (form-generator extension) |
| **3. Remaining widgets**   | Color, font, named-value, "Show advanced"        | T13-T16 | Phase 1                            |
| **4. Cleanup**             | Wizard refactor, label rewrites, document picker | T17-T19 | Phases 1-2                         |

**Parallelism notes for subagents:**

- Within Phase 1: T1, T2, T8 are independent leaves. T3 depends on T2. T4-T7 depend on T3.
- Within Phase 2: T9 depends on T3 (form-generator). T10 is independent. T11 depends on T9+T10. T12 depends on T11.
- Within Phase 3: All tasks depend on Phase 1's T3. Otherwise independent of each other.
- Phase 4: T17 depends on T1. T18-T19 independent.

---

## Phase 1 — Foundation tracer: theme picker end-to-end

This phase proves the side-table metadata mechanism + the DrillMode 4th case + the theme catalog. Lands a working theme picker the user can actually use.

### Task 1: Create the theme catalog

**Files:**

- Create: `packages/editor-app/src/theme-catalog.ts`
- Create: `packages/editor-app/test/theme-catalog.test.ts`

**Dependencies:** None. Can run in parallel with T2, T8.

**Why this matters:** Mirrors the `block-catalog.ts` precedent (ADR 0019). Drives the theme picker. The `stub` theme id is deliberately omitted (per CONTEXT.md "Theme catalog" entry).

**Step 1: Write the failing test**

```ts
// packages/editor-app/test/theme-catalog.test.ts
import { describe, expect, test } from "vitest";

import { buildThemeCatalog } from "../src/theme-catalog.js";

describe("buildThemeCatalog", () => {
  test("omits the stub theme id", () => {
    const catalog = buildThemeCatalog();
    expect(catalog.entries.map((e) => e.id)).not.toContain("stub");
  });

  test("includes the five v1 themes", () => {
    const catalog = buildThemeCatalog();
    const ids = catalog.entries.map((e) => e.id).sort();
    expect(ids).toEqual(["academic", "civic", "editorial", "minimal", "modern"]);
  });

  test("each entry has a non-empty label and description", () => {
    const catalog = buildThemeCatalog();
    for (const entry of catalog.entries) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  test("each entry has font lists (headline and body)", () => {
    const catalog = buildThemeCatalog();
    for (const entry of catalog.entries) {
      expect(entry.fonts.headline.length).toBeGreaterThan(0);
      expect(entry.fonts.body.length).toBeGreaterThan(0);
    }
  });

  test("entryFor returns a humanised fallback for unknown ids", () => {
    const catalog = buildThemeCatalog();
    const entry = catalog.entryFor("someFutureTheme");
    expect(entry.label).toBe("Some future theme");
    expect(entry.fonts.headline).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/editor-app/test/theme-catalog.test.ts`
Expected: FAIL — module not found.

**Step 3: Write minimal implementation**

```ts
// packages/editor-app/src/theme-catalog.ts
/**
 * Theme catalog — drives the theme picker. Mirrors `block-catalog.ts`
 * (ADR 0019): a side metadata table that maps renderer-registered
 * theme ids to user-facing labels, descriptions, and per-theme curated
 * font lists. The `stub` theme id is deliberately omitted per
 * CONTEXT.md.
 */

export interface ThemeFonts {
  readonly headline: readonly string[];
  readonly body: readonly string[];
}

export interface ThemeCatalogEntry {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly fonts: ThemeFonts;
}

export interface ThemeCatalog {
  readonly entries: readonly ThemeCatalogEntry[];
  entryFor(id: string): ThemeCatalogEntry;
}

const THEME_METADATA: Record<string, Omit<ThemeCatalogEntry, "id">> = {
  academic: {
    label: "Academic",
    description: "Serious, scholarly look — think research society or honors program.",
    fonts: {
      headline: ["Source Serif Pro", "Lora", "Crimson Pro"],
      body: ["Source Sans Pro", "Inter", "Lato"],
    },
  },
  civic: {
    label: "Civic",
    description: "Civically engaged feel — campaigns, advocacy, community.",
    fonts: {
      headline: ["Public Sans", "IBM Plex Sans", "Inter"],
      body: ["Public Sans", "Inter", "Roboto"],
    },
  },
  editorial: {
    label: "Editorial",
    description: "Magazine-style typography for storytelling-heavy orgs.",
    fonts: {
      headline: ["Playfair Display", "Source Serif Pro", "Bodoni Moda"],
      body: ["Source Serif Pro", "Lora", "Inter"],
    },
  },
  minimal: {
    label: "Minimal",
    description: "Quiet, neutral, gets out of your content's way.",
    fonts: {
      headline: ["Inter", "Helvetica Neue", "Arial"],
      body: ["Inter", "Helvetica Neue", "Arial"],
    },
  },
  modern: {
    label: "Modern",
    description: "Clean, bright, contemporary — fits youth-focused programs.",
    fonts: {
      headline: ["Outfit", "Manrope", "Inter"],
      body: ["Inter", "Manrope", "Roboto"],
    },
  },
};

function humanise(id: string): string {
  const spaced = id.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function entryForId(id: string): ThemeCatalogEntry {
  const meta = THEME_METADATA[id];
  if (meta !== undefined) {
    return { id, ...meta };
  }
  return {
    id,
    label: humanise(id),
    description: `Theme "${id}".`,
    fonts: { headline: [], body: [] },
  };
}

export function buildThemeCatalog(): ThemeCatalog {
  const entries = Object.keys(THEME_METADATA).sort().map(entryForId);
  return { entries, entryFor: entryForId };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run packages/editor-app/test/theme-catalog.test.ts`
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add packages/editor-app/src/theme-catalog.ts packages/editor-app/test/theme-catalog.test.ts
git commit -m "feat(editor): add theme catalog (ADR 0043)"
```

---

### Task 2: Create the field-override metadata scaffolding

**Files:**

- Create: `packages/editor-app/src/field-metadata.ts`
- Create: `packages/editor-app/test/field-metadata.test.ts`

**Dependencies:** None. Can run in parallel with T1, T8.

**Why this matters:** This is the side-table per ADR 0043 §"Side-table metadata (Option 2)". Path-keyed overrides for label, tier, renderer.

**Step 1: Write the failing test**

```ts
// packages/editor-app/test/field-metadata.test.ts
import { describe, expect, test } from "vitest";

import {
  lookupFieldOverride,
  SPINE_FIELD_METADATA,
  BLOCK_FIELD_METADATA,
} from "../src/field-metadata.js";

describe("field-metadata", () => {
  test("SPINE_FIELD_METADATA marks pages[].slug as advanced", () => {
    const entry = SPINE_FIELD_METADATA.find((e) => e.path === "pages.[].slug");
    expect(entry?.tier).toBe("advanced");
  });

  test("SPINE_FIELD_METADATA marks pages[].navOrder as hidden", () => {
    const entry = SPINE_FIELD_METADATA.find((e) => e.path === "pages.[].navOrder");
    expect(entry?.tier).toBe("hidden");
  });

  test("SPINE_FIELD_METADATA assigns the theme-picker renderer to theme.id", () => {
    const entry = SPINE_FIELD_METADATA.find((e) => e.path === "theme.id");
    expect(entry?.renderer).toBe("theme-picker");
  });

  test("lookupFieldOverride finds an entry by dotted path", () => {
    const result = lookupFieldOverride(SPINE_FIELD_METADATA, ["pages", 0, "slug"]);
    expect(result?.tier).toBe("advanced");
  });

  test("lookupFieldOverride normalises array indices to []", () => {
    // Array index 0 and 5 both match the wildcard "pages.[].slug" entry.
    const a = lookupFieldOverride(SPINE_FIELD_METADATA, ["pages", 0, "slug"]);
    const b = lookupFieldOverride(SPINE_FIELD_METADATA, ["pages", 5, "slug"]);
    expect(a?.tier).toBe("advanced");
    expect(b?.tier).toBe("advanced");
  });

  test("lookupFieldOverride returns undefined for paths with no override", () => {
    const result = lookupFieldOverride(SPINE_FIELD_METADATA, ["org", "name"]);
    expect(result).toBeUndefined();
  });

  test("BLOCK_FIELD_METADATA carries per-block-type entries", () => {
    // At minimum, the alt-text label rewrite applies to multiple block types.
    expect(BLOCK_FIELD_METADATA).toBeTypeOf("object");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/editor-app/test/field-metadata.test.ts`
Expected: FAIL — module not found.

**Step 3: Write minimal implementation**

```ts
// packages/editor-app/src/field-metadata.ts
/**
 * Field-override metadata — per ADR 0043 §"Side-table metadata".
 *
 * Two tables: one for the site spine, one keyed by block type. Each
 * entry is path-keyed (dotted; "[]" is the array-element wildcard) and
 * carries optional overrides for label, visibility tier, and
 * custom-renderer name.
 *
 * The form-generator and form-renderer read these tables to decide
 * what to show, what to hide, and which custom widget to mount for a
 * given leaf field. Unknown paths get the form-generator's default —
 * same drift-resistant fallback discipline as `block-catalog.ts`.
 */

export type FieldTier = "default" | "advanced" | "hidden";

export interface FieldOverride {
  /** Dotted path; "[]" is the array-element wildcard. */
  readonly path: string;
  readonly label?: string;
  readonly tier?: FieldTier;
  readonly renderer?: string;
}

export const SPINE_FIELD_METADATA: readonly FieldOverride[] = [
  // theme picker — see ADR 0043 §"Metadata renderer: slot"
  { path: "theme.id", renderer: "theme-picker" },
  // theme tokens — covered by ThemeForm (T13); not in the spine walk
  // because theme is carved out (T5)

  // Page-level advanced fields
  { path: "pages.[].slug", tier: "advanced", label: "Page address (the URL slug)" },
  { path: "pages.[].localizedAs", tier: "advanced", label: "Linked translation" },
  { path: "pages.[].seo.title", tier: "advanced", label: "Search engine title" },
  { path: "pages.[].seo.description", tier: "advanced", label: "Search engine snippet" },

  // Hidden — managed by reorder UI in pages-ops.ts
  { path: "pages.[].navOrder", tier: "hidden" },

  // Org label rewrites
  { path: "org.legalName", label: "Official organization name" },
  { path: "org.shortName", label: "Display name (used in nav)" },
];

export const BLOCK_FIELD_METADATA: Record<string, readonly FieldOverride[]> = {
  // Alt text relabel applies wherever a block has a user-editable alt.
  hero: [{ path: "backgroundAlt", label: "Image description (for screen readers)" }],
  quote: [{ path: "authorImageAlt", label: "Image description (for screen readers)" }],
  imageGallery: [{ path: "images.[].alt", label: "Image description (for screen readers)" }],
  teamGrid: [{ path: "people.[].photo.alt", label: "Image description (for screen readers)" }],
  partnerLogos: [{ path: "partners.[].logo.alt", label: "Image description (for screen readers)" }],
  ctaBanner: [{ path: "backgroundImage.alt", label: "Image description (for screen readers)" }],
};

/**
 * Look up an override for a concrete runtime path. Array indices in
 * the path are normalised to the wildcard "[]" for matching.
 */
export function lookupFieldOverride(
  table: readonly FieldOverride[],
  path: readonly (string | number)[],
): FieldOverride | undefined {
  const normalised = path.map((seg) => (typeof seg === "number" ? "[]" : seg)).join(".");
  return table.find((entry) => entry.path === normalised);
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run packages/editor-app/test/field-metadata.test.ts`
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add packages/editor-app/src/field-metadata.ts packages/editor-app/test/field-metadata.test.ts
git commit -m "feat(editor): add field-override metadata table (ADR 0043)"
```

---

### Task 3: Extend form-generator with renderer dispatch and metadata lookup

**Files:**

- Modify: `packages/editor-app/src/form-generator.ts`
- Modify: `packages/editor-app/test/form-generator.test.ts`

**Dependencies:** T2 (uses `FieldOverride`).

**Why this matters:** This is the entry point for both override mechanisms (schema-identity dispatch AND metadata lookup). The form-generator now returns a `FieldNode` of kind `"custom"` when an override applies, carrying the renderer name.

**Step 1: Write the failing test**

Add to `packages/editor-app/test/form-generator.test.ts`:

```ts
import { z } from "zod";
import { fieldsFromSchema } from "../src/form-generator.js";

describe("form-generator custom dispatch (ADR 0043)", () => {
  test("emits a custom node when a path matches a renderer override", () => {
    const schema = z.object({
      themeId: z.string().min(1),
    });
    const overrides = [{ path: "themeId", renderer: "theme-picker" }];
    const fields = fieldsFromSchema(schema, { overrides });
    expect(fields[0].kind).toBe("custom");
    if (fields[0].kind === "custom") {
      expect(fields[0].renderer).toBe("theme-picker");
    }
  });

  test("emits a custom node when a schema matches the registry", () => {
    const InnerSchema = z.object({ hash: z.string(), mime: z.string() });
    const outer = z.object({ asset: InnerSchema });
    const fields = fieldsFromSchema(outer, {
      schemaRenderers: new Map([[InnerSchema, "asset-picker"]]),
    });
    // The "asset" field should be a custom node, not an object node.
    expect(fields[0].kind).toBe("custom");
    if (fields[0].kind === "custom") {
      expect(fields[0].renderer).toBe("asset-picker");
    }
  });

  test("passes through default rendering when no override applies", () => {
    const schema = z.object({ name: z.string() });
    const fields = fieldsFromSchema(schema, {});
    expect(fields[0].kind).toBe("string");
  });

  test("attaches label override to default nodes", () => {
    const schema = z.object({ slug: z.string() });
    const overrides = [{ path: "slug", label: "Page address" }];
    const fields = fieldsFromSchema(schema, { overrides });
    expect(fields[0].kind).toBe("string");
    expect(fields[0].label).toBe("Page address");
  });

  test("attaches tier override to default nodes", () => {
    const schema = z.object({ slug: z.string() });
    const overrides = [{ path: "slug", tier: "advanced" as const }];
    const fields = fieldsFromSchema(schema, { overrides });
    expect(fields[0].tier).toBe("advanced");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/editor-app/test/form-generator.test.ts -t "custom dispatch"`
Expected: FAIL — `fieldsFromSchema` doesn't accept a second argument.

**Step 3: Modify form-generator.ts**

Extend the `FieldNode` discriminated union with a `"custom"` case, add `label?` and `tier?` to all existing kinds, accept an options bag with overrides + schema renderer registry, and apply both in the walker.

Key changes:

1. Add `"custom"` kind: `{ kind: "custom"; name: string; path: ...; optional: boolean; renderer: string }`.
2. Add `label?: string` and `tier?: FieldTier` to every existing kind.
3. Signature change: `fieldsFromSchema(schema, options?: { overrides?: readonly FieldOverride[]; schemaRenderers?: Map<ZodType, string> })`.
4. Inside `nodeFor`: after stripping wrappers, check `schemaRenderers.get(currentSchema)` — return a custom node if matched.
5. Inside `nodeFor`: lookup `overrides` by current path — apply label/tier; if `renderer` is set, return a custom node.

Refer to ADR 0043 for exact dispatch semantics. The schema-identity check goes FIRST (it's more specific); the path-keyed override check is SECOND.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run packages/editor-app/test/form-generator.test.ts`
Expected: All tests PASS (including the existing ones — this is an additive change).

**Step 5: Commit**

```bash
git add packages/editor-app/src/form-generator.ts packages/editor-app/test/form-generator.test.ts
git commit -m "feat(editor): form-generator custom dispatch + override lookup (ADR 0043)"
```

---

### Task 4: Build the theme picker component

**Files:**

- Create: `packages/editor-app/src/theme-picker.tsx`
- Create: `packages/editor-app/test/theme-picker.test.tsx`

**Dependencies:** T1 (theme catalog), T3 (form-generator custom kind).

**Why this matters:** This is the widget that replaces the raw `<input>` for `theme.id`.

**Step 1: Write the failing test**

```tsx
// packages/editor-app/test/theme-picker.test.tsx
import { describe, expect, test } from "vitest";
import { render } from "@testing-library/preact";

import { ThemePicker } from "../src/theme-picker.js";

describe("ThemePicker", () => {
  test("renders one option per cataloged theme (5 — stub omitted)", () => {
    const { container } = render(<ThemePicker value="academic" onChange={() => {}} />);
    const options = container.querySelectorAll("[data-theme-option]");
    expect(options.length).toBe(5);
  });

  test("marks the active option", () => {
    const { container } = render(<ThemePicker value="civic" onChange={() => {}} />);
    const active = container.querySelector('[data-theme-option][data-active="true"]');
    expect(active?.getAttribute("data-theme-id")).toBe("civic");
  });

  test("invokes onChange with the new theme id when an option is clicked", () => {
    let received = "";
    const { container } = render(
      <ThemePicker value="academic" onChange={(id) => (received = id)} />,
    );
    const civic = container.querySelector('[data-theme-id="civic"]') as HTMLElement;
    civic.click();
    expect(received).toBe("civic");
  });

  test("renders an unknown theme id via the catalog's humanise fallback (no crash)", () => {
    const { container } = render(<ThemePicker value="someFutureTheme" onChange={() => {}} />);
    // The current value is shown even if it isn't cataloged — never a fallback
    // to a raw text input (per ADR 0044).
    expect(container.querySelector('input[type="text"]')).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/editor-app/test/theme-picker.test.tsx`
Expected: FAIL — module not found.

**Step 3: Implement `packages/editor-app/src/theme-picker.tsx`**

A Preact component that reads from `buildThemeCatalog()`, renders one option per entry (radio-list style), marks the active one, fires `onChange` on click. Never emit a fallback `<input type="text">` (ADR 0044).

Component contract:

```ts
interface ThemePickerProps {
  readonly value: string;
  readonly onChange: (id: string) => void;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run packages/editor-app/test/theme-picker.test.tsx`

**Step 5: Commit**

```bash
git add packages/editor-app/src/theme-picker.tsx packages/editor-app/test/theme-picker.test.tsx
git commit -m "feat(editor): theme picker component (ADR 0043)"
```

---

### Task 5: Carve `theme` out of the SpineForm walk

**Files:**

- Modify: `packages/editor-app/src/form-generator.ts` (extend the `blocks` carve-out to also skip `theme`)
- Modify: `packages/editor-app/test/form-generator.test.ts` (add a regression test)

**Dependencies:** T3.

**Why this matters:** Per CONTEXT.md's revised Site spine: "Everything in the Site schema _except_ `pages[].blocks` **and `theme`**". The ThemeForm (T6) handles theme; SpineForm must not also render it.

**Step 1: Write the failing test**

```ts
test("SpineForm walk skips the theme sub-tree", () => {
  // Build a tiny spine-like schema and verify theme is omitted.
  const schema = z.object({
    org: z.object({ name: z.string() }),
    theme: z.object({ id: z.string() }),
  });
  const fields = fieldsFromSchema(schema, {});
  const fieldNames = fields.map((f) => f.name);
  expect(fieldNames).toContain("org");
  expect(fieldNames).not.toContain("theme");
});
```

**Step 2-5:** Modify the `object` case in `nodeFor` to also filter out `"theme"` from the top-level walk (similar to the existing `"blocks"` filter). Carve-out is at top-level only; nested `theme` keys in unrelated paths aren't affected. Commit:

```bash
git commit -m "refactor(editor): carve theme out of SpineForm walk (ADR 0043, CONTEXT.md)"
```

---

### Task 6: Build the ThemeForm component

**Files:**

- Create: `packages/editor-app/src/theme-form.tsx`
- Create: `packages/editor-app/test/theme-form.test.tsx`

**Dependencies:** T3, T4, T5.

**Why this matters:** The form behind the theme drill-in. In Phase 1 it only contains the ThemePicker; tokens land in Phase 3 (T13-T15). This keeps Phase 1 a small, complete tracer.

**Step 1: Write the failing test**

```tsx
import { ThemeForm } from "../src/theme-form.js";

test("ThemeForm renders the theme picker", () => {
  const site = { theme: { id: "academic" } };
  const { container } = render(<ThemeForm site={site} onChange={() => {}} />);
  expect(container.querySelector('[data-testid="theme-picker"]')).not.toBeNull();
});

test("ThemeForm onChange writes a new theme id back to the site", () => {
  let next: any = null;
  const site = { theme: { id: "academic" } };
  const { container } = render(<ThemeForm site={site} onChange={(s) => (next = s)} />);
  const civic = container.querySelector('[data-theme-id="civic"]') as HTMLElement;
  civic.click();
  expect(next.theme.id).toBe("civic");
});

test("ThemeForm does not render any auto-generated text inputs for theme.id", () => {
  // ADR 0044 invariant: never a raw input.
  const site = { theme: { id: "academic" } };
  const { container } = render(<ThemeForm site={site} onChange={() => {}} />);
  expect(container.querySelector('input[type="text"]')).toBeNull();
});
```

**Step 2-5:** Implement, commit:

```bash
git commit -m "feat(editor): ThemeForm component for theme drill-in (ADR 0043)"
```

---

### Task 7: Add the `theme` DrillMode case to EditorApp

**Files:**

- Modify: `packages/editor-app/src/editor-app.tsx`
- Modify: `packages/editor-app/test/editor-drill-in.test.tsx`

**Dependencies:** T6.

**Why this matters:** Per ADR 0042 the editor pane has three drill-in cases (`blocks` / `block` / `settings`); this task adds the 4th: `theme`. A "Theme" affordance in the un-drilled `blocks` view drills into ThemeForm.

**Step 1: Write the failing test**

Add to `editor-drill-in.test.tsx`:

```tsx
test("clicking the Theme affordance drills into the ThemeForm", async () => {
  const { container } = render(<EditorApp initial={makeSeedSite()} />);
  const themeLink = container.querySelector('[data-testid="drill-in-theme"]') as HTMLElement;
  expect(themeLink).not.toBeNull();
  themeLink.click();
  await Promise.resolve();
  expect(container.querySelector('[data-testid="theme-form"]')).not.toBeNull();
});

test("ThemeForm has a back affordance that returns to the blocks view", async () => {
  // similar shape; clicks back, asserts ThemeForm is gone
});
```

**Step 2-5:** Extend the `DrillMode` discriminated union with `{ kind: "theme" }`, add the affordance + the back button, route to ThemeForm. Commit:

```bash
git commit -m "feat(editor): theme drill-in case in DrillMode (ADR 0042, ADR 0043)"
```

---

### Task 8: Validation warning for unknown `theme.id`

**Files:**

- Modify: `packages/schema/src/validate.ts`
- Modify: `packages/schema/test/validate.test.ts`

**Dependencies:** None. Can run in parallel with T1, T2.

**Why this matters:** Per ADR 0044 Corollary 3, the schema stays loose (`z.string().min(1)`) for round-trip identity; closed-set discipline is enforced at the validation layer as a warning-tier rule.

**Step 1: Write the failing test**

```ts
test("emits a warning for an unknown theme id", () => {
  const site = makeMinimalSite({ themeId: "someFutureTheme" });
  const result = validate(site);
  const warning = result.warnings.find((w) => w.code === "site.theme.id.unknown");
  expect(warning).toBeDefined();
  expect(warning?.path).toEqual(["theme", "id"]);
});

test("does NOT emit a warning for a known theme id", () => {
  const site = makeMinimalSite({ themeId: "academic" });
  const result = validate(site);
  const warning = result.warnings.find((w) => w.code === "site.theme.id.unknown");
  expect(warning).toBeUndefined();
});

test("a snapshot with an unknown theme id still parses (round-trip preserved)", () => {
  const site = makeMinimalSite({ themeId: "someFutureTheme" });
  const result = validate(site);
  expect(result.ok).toBe(true);
});
```

**Step 2-5:** Add the rule. Known IDs come from a constant array in the schema package mirroring the renderer-side `*_THEME_ID` exports (note: this creates a small duplication; resolve in T17 by exporting `ALL_THEME_IDS` from `@sosb/renderer` if that's clean, or accept the duplication if the renderer doesn't want to expose it). Commit:

```bash
git commit -m "feat(schema): warn on unknown theme id (ADR 0044 corollary 3)"
```

**End of Phase 1.** Theme picker is now wired end-to-end. User can drill into Theme, pick a theme, see it apply via the existing preview iframe.

---

## Phase 2 — Asset picker tracer: schema-identity dispatch

This phase proves the schema-identity dispatch mechanism and wires the existing `@sosb/assets` pipeline to the UI. Eliminates the worst hash/mime/path text-input failure.

### Task 9: Add schema-identity dispatch to form-generator

**Files:** `packages/editor-app/src/form-generator.ts`, `packages/editor-app/test/form-generator.test.ts`

**Dependencies:** T3.

**What:** Already partially landed in T3 (test asserts a `schemaRenderers` map works). T9 is the integration test: when `AssetRefSchema` (imported from `@sosb/schema`) is in the registry, every `AssetRef` field in every block-data schema dispatches to the asset-picker renderer.

Test that walks `ImageGalleryDataSchema` with `[[AssetRefSchema, "asset-picker"]]` in the registry and asserts every `images.[].asset` slot emits a custom node, NOT a nested object.

Commit:

```bash
git commit -m "feat(editor): schema-identity dispatch integration test (ADR 0043)"
```

---

### Task 10: Build the AssetPicker component (image variant)

**Files:**

- Create: `packages/editor-app/src/asset-picker.tsx`
- Create: `packages/editor-app/test/asset-picker.test.tsx`

**Dependencies:** None for the component shell. Uses `@sosb/assets`' `uploadAsset` for the upload path.

**Why this matters:** The widget that replaces the auto-generated hash/mime/path/etc. fieldset. Upload-only per CONTEXT.md (no library reuse). Empty state never falls back to raw inputs (ADR 0044 Corollary 2).

**Component contract:**

```tsx
interface AssetPickerProps {
  readonly value: AssetRefLike | undefined;
  readonly onChange: (next: AssetRefLike) => void;
  /** Required: how this picker writes to the VFS. Injected so tests can mock. */
  readonly uploader: (file: File) => Promise<AssetRefLike>;
}
```

**Tests must cover:**

1. With `value` set: renders a thumbnail using `<img src={value.path}>`. NO text inputs anywhere.
2. With `value` undefined: shows "Add image" CTA. NO text inputs.
3. With a stale `value` whose `path` doesn't resolve (image fails to load): empty state is "missing asset" + a re-upload button. NO text inputs.
4. Click "Upload" → file picker fires → `uploader` resolves → `onChange` called with new AssetRef.
5. **Critical (ADR 0044):** no code path renders any `<input>` other than `<input type="file">` for uploading.

Commit:

```bash
git commit -m "feat(editor): asset picker component, upload-only (ADR 0044 corollaries 1,2)"
```

---

### Task 11: Wire the AssetPicker into BlockForm via schema-identity dispatch

**Files:**

- Modify: `packages/editor-app/src/block-form.tsx` (register `AssetRefSchema` → AssetPicker renderer)
- Modify: `packages/editor-app/src/editor-app.tsx` (provide the `uploader` callback)
- Modify: `packages/editor-app/test/block-form.test.tsx`

**Dependencies:** T9, T10.

**What:** Pass a `schemaRenderers` map into `fieldsFromSchema`. When the walker emits a `"custom"` node with renderer `"asset-picker"`, the form-renderer mounts `<AssetPicker>` at that path. Wire up onChange to fire `onPatch` on the AssetRef path.

Test: render BlockForm for `imageGallery`, assert no `hash` text input exists, assert one AssetPicker exists per image.

Commit:

```bash
git commit -m "feat(editor): wire AssetPicker into BlockForm via schema-identity dispatch (ADR 0043)"
```

---

### Task 12: Round-trip regression test (zero re-uploads, ADR 0044 Corollary 1)

**Files:**

- Create: `e2e/round-trip-zero-reuploads.spec.ts`

**Dependencies:** T11.

**What:** A Playwright test that loads a fixture site with one image-gallery block, exports the zip, reimports it, navigates to the gallery block, and asserts ZERO "Upload" affordances are rendered (the picker shows the existing image's thumbnail from VFS).

This test is the load-bearing assertion for ADR 0044 Corollary 1. If it ever fails, a power-user fallback has been introduced and should be reverted.

Commit:

```bash
git commit -m "test(e2e): zero re-uploads on round-trip (ADR 0044 corollary 1)"
```

**End of Phase 2.** Asset picker works in `imageGallery`. Round-trip invariant is enforced by test.

---

## Phase 3 — Remaining widgets (parallelizable)

All four tasks below depend on T3 only; otherwise independent of each other.

### Task 13: ColorPicker widget for `theme.tokens.color*`

**Files:** `packages/editor-app/src/color-picker.tsx`, `packages/editor-app/test/color-picker.test.tsx`

Native `<input type="color">` wrapped to handle `value: string | undefined` (undefined = use theme default; user can clear to revert). Test renders + asserts native picker, asserts onChange round-trips hex strings. Wire into ThemeForm.

Commit: `feat(editor): color picker for theme tokens (ADR 0043)`

### Task 14: FontPicker widget for `theme.tokens.font*`

**Files:** `packages/editor-app/src/font-picker.tsx`, `packages/editor-app/test/font-picker.test.tsx`

Reads the active theme's `fonts.headline` / `fonts.body` from the theme catalog (T1). Renders a `<select>` with the per-theme list + a "(use theme default)" option for the undefined case. Wire into ThemeForm.

Commit: `feat(editor): font picker drawn from per-theme catalog (ADR 0043)`

### Task 15: NamedValueSelect widget for `density` and `radius`

**Files:** `packages/editor-app/src/named-value-select.tsx`, `packages/editor-app/test/named-value-select.test.tsx`

Generic component taking a list of `{ value: string; label: string }`. Two instances in ThemeForm: density (`compact` / `normal` / `comfortable`) and radius (`sharp` / `soft` / `round`).

Commit: `feat(editor): named-value select for density/radius (ADR 0043)`

### Task 16: "Show advanced" toggle in BlockForm and SpineForm

**Files:**

- Modify: `packages/editor-app/src/block-form.tsx`
- Modify: `packages/editor-app/src/spine-form.tsx`
- Create: `packages/editor-app/src/advanced-toggle.tsx`
- Create: `packages/editor-app/test/advanced-toggle.test.tsx`

**Dependencies:** T2, T3.

Per ADR 0043 + CONTEXT.md "Show advanced" toggle:

- Per-form local state (no persistence, no localStorage)
- Default hidden
- Toggling reveals fields whose metadata declares `tier: "advanced"`
- Fields with `tier: "hidden"` are NEVER rendered (toggle has no effect)
- The wizard does NOT render the toggle

Tests must cover:

- Toggle off → advanced fields not in DOM
- Toggle on → advanced fields in DOM
- `tier: "hidden"` fields never in DOM regardless of toggle
- Toggle state is per-form-instance (mounting a second form starts hidden)

Commit: `feat(editor): per-form Show advanced toggle (ADR 0043)`

**End of Phase 3.** ThemeForm is complete with all 6 token widgets. Advanced fields hide-by-default everywhere.

---

## Phase 4 — Cleanup

### Task 17: Refactor wizard to read theme catalog

**Files:**

- Modify: `packages/wizard/src/steps/identity.tsx`
- Modify: `packages/wizard/test/identity-step.test.tsx`

**Dependencies:** T1.

Delete the inline `THEMES` array in `identity.tsx`; import `buildThemeCatalog()` from `@sosb/editor-app`. (Note: wizard currently does not depend on editor-app. Either lift the catalog into a shared package, or accept the dep direction — the simpler call is to lift `theme-catalog.ts` into a new `@sosb/themes-catalog` package, OR put the catalog in `@sosb/themes` directly. Decide and document this when you reach the task — Option A in ADR 0043's "alternatives considered" was about _where the catalog lives_, not which package owns it; you may revisit.)

Commit: `refactor(wizard): read themes from catalog (ADR 0043 follow-up)`

### Task 18: DocumentPicker variant of AssetPicker for `documentDownloads`

**Files:** Modify `asset-picker.tsx` to handle `DocumentRefSchema` (or create a sibling), wire into form-generator's schema-identity registry.

**Dependencies:** T10, T11.

DocumentRef has `mime: string` (any MIME, not the image-supported set) plus `byteSize`. Picker should show document icon + filename + size; no thumbnail.

Commit: `feat(editor): document picker variant for documentDownloads (ADR 0043)`

### Task 19: Remove placeholder `hash: "placeholder"` strings from block-defaults

**Files:** `packages/editor-app/src/block-defaults.ts`

**Dependencies:** T11, T18.

With the asset picker in place, a freshly-added block can ship with `asset: undefined` (or an explicit "no asset" sentinel) instead of a fake AssetRef. The picker's empty state takes over. This is the cleanup that closes ADR 0044 Corollary 2 — no fake metadata leaks into snapshots.

Update tests in `block-defaults.test.ts` to match.

Commit: `refactor(editor): drop placeholder AssetRef strings from block defaults (ADR 0044)`

**End of Phase 4.** All work landed.

---

## Verification gates (each phase)

After each phase, run the full test suite + e2e:

```bash
pnpm vitest run
pnpm exec playwright test
```

Expected: green across the board. The round-trip regression test (T12) is the load-bearing one — if it ever goes red, a regression against ADR 0044 has shipped and the offending change should be reverted, not patched.

---

## Done-criteria

- [ ] No `<input type="text">` exists anywhere in the editor for `AssetRef` fields, `theme.id`, or `theme.tokens.*` fields.
- [ ] Round-trip regression test passes (zero re-uploads on import).
- [ ] Advanced fields (`slug`, `localizedAs`, `seo.*`) are hidden by default in BlockForm/SpineForm.
- [ ] `pages[].navOrder` is never rendered as a numeric input (only edited via reorder UI).
- [ ] `alt`-labelled inputs everywhere read "Image description (for screen readers)".
- [ ] The wizard reads themes from the catalog.
- [ ] `validate()` emits a warning-tier issue for unknown `theme.id` values.
- [ ] ADRs 0043 and 0044 are referenced in commit messages where applicable.

---

## What is NOT in this plan (deliberately)

- **Asset library reuse panel.** Per CONTEXT.md "Asset picker": v1 is upload-only. Deferred.
- **Help/tooltip text per field.** Per ADR 0043 §"Out of scope": label rewrites only; tooltips later.
- **Screenshots in the theme catalog.** Per CONTEXT.md "Theme catalog": deferred past v1.
- **`embed.provider` relabel or pickerification.** Out of scope for this plan; embed is already in the `advanced` block category.
- **Animation/transition polish for drill-in/drill-out.** Pre-existing pattern from ADR 0042 is reused as-is.
