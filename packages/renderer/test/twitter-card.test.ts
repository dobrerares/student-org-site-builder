import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import heroOnly from "./fixtures/hero-only.json" with { type: "json" };
import { renderSite } from "../src/index.js";

const fixture = heroOnly as unknown as Site;

/**
 * Twitter Card tags emitted in <head> by the renderer (parity with og:*).
 *
 * Per PRD § 249, every page ships Open Graph + Twitter Card tags. The
 * renderer emits the *card type* and the *title/description/image* parity
 * tags; the build pipeline overlays absolute URLs (twitter:image absolute)
 * the same way it overlays og:image.
 *
 * Card type defaults to summary_large_image when the page's first hero has
 * a backgroundImage; otherwise summary.
 */
describe("renderSite - Twitter Card baseline (renderer)", () => {
  test("emits twitter:card with summary_large_image when hero has a backgroundImage", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/<meta name="twitter:card" content="summary_large_image"/);
  });

  test("emits twitter:title parity with og:title", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/<meta name="twitter:title" content="Stub site — home"/);
  });

  test("emits twitter:description parity with og:description", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/<meta name="twitter:description"/);
  });

  test("emits twitter:image referencing the hero backgroundImage (relative — build overlays absolute)", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/<meta name="twitter:image" content="assets\/hero\.jpg"/);
  });

  test("falls back to twitter:card summary when no hero backgroundImage", () => {
    const noImage = structuredClone(fixture) as Site;
    delete (noImage.pages[0]!.blocks[0]!.data as { backgroundImage?: string }).backgroundImage;
    const html = renderSite(noImage, "stub");
    expect(html).toMatch(/<meta name="twitter:card" content="summary"/);
    expect(html).not.toMatch(/<meta name="twitter:image"/);
  });
});
