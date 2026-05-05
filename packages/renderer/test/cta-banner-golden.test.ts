import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import ctaFixture from "./fixtures/cta-banner-only.json" with { type: "json" };
import { renderSite } from "../src/index.js";

const fixture = ctaFixture as unknown as Site;

/**
 * Golden-file snapshot for ctaBanner × stub theme (the "Academic stub").
 *
 * Same framework as the hero golden test (#46): vitest's
 * `toMatchFileSnapshot` writes the golden file on first run and diffs against
 * it afterwards. Theme-specific golden files (academic, modern, …) land with
 * the themes (#28-#31, #47).
 */
describe("golden-file framework — ctaBanner × stub theme", () => {
  test("ctaBanner with backgroundImage matches its golden file", async () => {
    const html = renderSite(fixture, "stub");
    await expect(html).toMatchFileSnapshot("__golden__/stub-theme-cta-banner.html");
  });

  test("ctaBanner without backgroundImage matches its solid-color golden file", async () => {
    const minimal = structuredClone(fixture) as Site;
    const block = minimal.pages[0]!.blocks[1]!.data as Record<string, unknown>;
    delete block.backgroundImage;
    const html = renderSite(minimal, "stub");
    await expect(html).toMatchFileSnapshot("__golden__/stub-theme-cta-banner-solid.html");
  });
});
