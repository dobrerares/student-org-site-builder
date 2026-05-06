import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import heroOnlyMinimal from "./fixtures/hero-only-minimal.json" with { type: "json" };
import { renderSite } from "../src/index.js";

const fixture = heroOnlyMinimal as unknown as Site;

/**
 * Minimal theme — hero golden file.
 *
 * One curated golden snapshot for the hero block under the Minimal theme.
 * Per-block goldens for the other 14 blocks are deferred until those blocks
 * exist (#9–#22); when they land, each adds a `minimal-theme-<block>.html`
 * snapshot.
 */

describe("golden-file — minimal theme + hero", () => {
  test("hero-only minimal-theme render matches its golden file", async () => {
    const html = renderSite(fixture, "minimal");
    await expect(html).toMatchFileSnapshot("__golden__/minimal-theme-hero.html");
  });
});
