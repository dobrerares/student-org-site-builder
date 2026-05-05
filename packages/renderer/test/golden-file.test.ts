import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import heroOnly from "./fixtures/hero-only.json" with { type: "json" };
import teamGridHistoripol from "./fixtures/team-grid-historipol.json" with { type: "json" };
import imageGalleryOnly from "./fixtures/image-gallery-only.json" with { type: "json" };
import documentDownloads from "./fixtures/document-downloads.json" with { type: "json" };
import { renderSite } from "../src/index.js";

const heroFixture = heroOnly as unknown as Site;
const teamGridFixture = teamGridHistoripol as unknown as Site;
const galleryFixture = imageGalleryOnly as unknown as Site;
const docsFixture = documentDownloads as unknown as Site;

/**
 * Golden-file framework.
 *
 * The PRD requires snapshot/golden-file tests so that the 15-block × 5-theme
 * matrix is regression-checked. v1 ships hero + imageGallery + documentDownloads
 * on the stub theme today; real curated golden files land per theme (#47,
 * #28-#31) and per block as their issues progress. The Academic-theme
 * imageGallery golden is owned by #47 — issue #14 ships the stub-theme
 * equivalent so that the regression net catches every renderer-side change
 * to the new block. documentDownloads (issue #21) follows the same pattern;
 * it is structurally identical across themes (no per-theme layout variant —
 * see PRD §"Renderer & themes"), so the stub golden stands in until #47.
 *
 * Implementation choice: vitest's built-in `toMatchFileSnapshot` writes the
 * golden file alongside the test on first run and diffs against it on every
 * subsequent run. CI fails if drift occurs. This avoids pulling in a third
 * snapshot lib. ADR 0003 records the choice.
 */

describe("golden-file framework — stub theme + hero", () => {
  test("hero-only stub-theme render matches its golden file", async () => {
    const html = renderSite(heroFixture, "stub");
    await expect(html).toMatchFileSnapshot("__golden__/stub-theme-hero.html");
  });
});

describe("golden-file framework — stub theme + grouped teamGrid", () => {
  test("HISTORIPOL teamGrid stub-theme render matches its golden file", async () => {
    // The PRD's "Academic theme" (#47) lands the curated themed golden; the
    // stub theme is what this issue ships under, so the canonical snapshot
    // for a grouped teamGrid lives here. The Academic golden re-uses the
    // same fixture once #47 wires up.
    const html = renderSite(teamGridFixture, "stub");
    await expect(html).toMatchFileSnapshot("__golden__/stub-theme-team-grid-grouped.html");
  });
});

describe("golden-file framework — stub theme + imageGallery", () => {
  test("imageGallery stub-theme render matches its golden file", async () => {
    const html = renderSite(galleryFixture, "stub");
    await expect(html).toMatchFileSnapshot("__golden__/stub-theme-image-gallery.html");
  });
});

describe("golden-file framework — stub theme + documentDownloads", () => {
  test("documentDownloads × stub render matches its golden file", async () => {
    const html = renderSite(docsFixture, "stub");
    await expect(html).toMatchFileSnapshot("__golden__/stub-theme-document-downloads.html");
  });
});
