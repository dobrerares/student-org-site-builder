/**
 * Guard: builder styling never reaches public-site output.
 *
 * ADR 0049 draws the line — React builder UI on one side, Preact public-site
 * Renderer on the other, meeting through Site data and rendered HTML. The
 * shared `@sosb/ui` package carries Tailwind-compiled *builder* CSS and Base
 * UI runtime code. None of it belongs in an exported site: it would bloat
 * every page, leak editor-only class names into a public artefact, and put
 * an editing runtime in front of readers.
 *
 * Two checks, because there are two ways the boundary could break:
 *
 *  1. Content. Nothing `build()` emits may contain builder CSS markers or
 *     builder runtime references.
 *  2. Dependency. `@sosb/build` and `@sosb/renderer` must not depend on
 *     `@sosb/ui`, React, or any builder-only package — the content check
 *     alone would pass right up until someone imported one.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";

import singlePageSite from "./fixtures/single-page-site.json" with { type: "json" };
import multiPage from "./fixtures/multi-page-site.json" with { type: "json" };
import { build } from "../src/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");

const fixtures: readonly Site[] = [
  singlePageSite as unknown as Site,
  multiPage as unknown as Site,
];

/**
 * Markers that only ever appear in builder output.
 *
 * `data-sosb-ui` is the opt-in reset hook every `@sosb/ui` control carries;
 * `--color-popover` / `--radius-sosb-` are builder theme tokens; the
 * package specifiers would indicate a builder runtime import.
 */
const BUILDER_MARKERS: readonly string[] = [
  "data-sosb-ui",
  "--radius-sosb-",
  "--color-popover",
  "@sosb/ui",
  "@base-ui-components",
  "react-dom",
  "sosb-ui-style",
];

describe("public output carries no builder styling or runtime", () => {
  for (const [index, fixture] of fixtures.entries()) {
    test(`fixture ${index}: no builder marker appears in any emitted file`, () => {
      const dist = build(fixture);
      for (const [filePath, contents] of dist) {
        const text = typeof contents === "string" ? contents : "";
        for (const marker of BUILDER_MARKERS) {
          expect(
            text.includes(marker),
            `${filePath} contains the builder-only marker ${marker}`,
          ).toBe(false);
        }
      }
    });
  }
});

describe("build and renderer do not depend on the builder UI", () => {
  const forbidden = ["@sosb/ui", "@sosb/editor-app", "@sosb/wizard", "react", "react-dom"];

  for (const pkg of ["build", "renderer"]) {
    test(`@sosb/${pkg} declares no builder-only dependency`, () => {
      const manifest = JSON.parse(
        readFileSync(path.join(repoRoot, "packages", pkg, "package.json"), "utf8"),
      ) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
      const declared = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });
      for (const name of forbidden) {
        expect(declared, `@sosb/${pkg} must not depend on ${name}`).not.toContain(name);
      }
    });
  }
});
