import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import heroOnly from "./fixtures/hero-only.json" with { type: "json" };
import { renderSite } from "../src/index.js";

const fixture = heroOnly as unknown as Site;

/**
 * Golden-file framework.
 *
 * The PRD requires snapshot/golden-file tests so that the 15-block × 5-theme
 * matrix is regression-checked. v1 ships only the hero block + the stub
 * theme, which is enough to wire the framework. Real curated golden files
 * land per theme (#47, #28-#31) and per block (#9-#22).
 *
 * Implementation choice: vitest's built-in `toMatchFileSnapshot` writes the
 * golden file alongside the test on first run and diffs against it on every
 * subsequent run. CI fails if drift occurs. This avoids pulling in a third
 * snapshot lib. ADR 0003 records the choice.
 */

describe("golden-file framework — stub theme + hero", () => {
  test("hero-only stub-theme render matches its golden file", async () => {
    const html = renderSite(fixture, "stub");
    await expect(html).toMatchFileSnapshot("__golden__/stub-theme-hero.html");
  });
});
