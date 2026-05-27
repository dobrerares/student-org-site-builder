import { describe, expect, test } from "vitest";
import { renderSite } from "@sosb/renderer";
import type { Site } from "@sosb/schema";

import minimal from "./fixtures/minimal-site.json" with { type: "json" };
import { renderPreviewHtml } from "../src/preview-html.js";
import { iframeSrcdoc } from "../src/iframe-srcdoc.js";

const baseSite = minimal as unknown as Site;

/**
 * AC: the iframe preview uses the same renderer code as the build pipeline —
 * NO duplicate code path.
 *
 * This test asserts byte-equality between the editor's preview HTML and a
 * direct call to `renderSite()` from `@sosb/renderer`. If the editor ever
 * forks renderer logic (a localised string transform, an editor-only meta
 * tag, etc.) this test fails.
 *
 * NOTE: `iframeSrcdoc` itself passes `mode: "preview"` so it gets the
 * preview-mode delta (the nav-click interceptor — see #${"<insert issue>"}).
 * Byte-equality is asserted between `renderPreviewHtml` and `renderSite`
 * with matching opts, which preserves the "one code path" invariant.
 */
describe("iframe preview reuses @sosb/renderer", () => {
  test("renderPreviewHtml byte-equals renderSite for the same input", () => {
    const direct = renderSite(baseSite, "stub");
    const preview = renderPreviewHtml(baseSite, "stub");
    expect(preview).toBe(direct);
  });

  test("iframeSrcdoc opts into preview mode so nav clicks can be intercepted", () => {
    // Two-page site so the preview-mode nav script actually emits (it's
    // gated on multi-page nav).
    const twoPageSite: Site = structuredClone(baseSite);
    twoPageSite.pages.push({
      ...twoPageSite.pages[0]!,
      slug: "despre",
      navLabel: "Despre",
      navOrder: 1,
      blocks: [
        {
          id: "blk_about_hero",
          type: "hero",
          version: 1,
          data: { title: "Despre noi" },
        },
      ],
    });
    const html = iframeSrcdoc(twoPageSite, "stub");
    expect(html).toContain("data-sosb-preview-nav");
  });

  test("a different page index round-trips through both code paths identically", () => {
    const twoPageSite: Site = structuredClone(baseSite);
    twoPageSite.pages.push({
      ...twoPageSite.pages[0]!,
      slug: "despre",
      navLabel: "Despre",
      navOrder: 1,
      blocks: [
        {
          id: "blk_about_hero",
          type: "hero",
          version: 1,
          data: { title: "Despre noi" },
        },
      ],
    });

    const direct = renderSite(twoPageSite, "stub", { pageIndex: 1 });
    const preview = renderPreviewHtml(twoPageSite, "stub", { pageIndex: 1 });
    expect(preview).toBe(direct);
  });

  test("iframeSrcdoc passes the preview asset resolver through to the renderer", () => {
    const site: Site = structuredClone(baseSite);
    site.pages[0]!.blocks = [
      {
        id: "blk_home_hero",
        type: "hero",
        version: 1,
        data: {
          title: "Preview",
          backgroundImage: {
            hash: "hero",
            path: "assets/hero.jpg",
            metadataPath: "assets/hero.metadata.json",
            mime: "image/jpeg",
            width: 1600,
            height: 1067,
            alt: "Hero",
          },
        },
      },
    ];

    const html = iframeSrcdoc(site, "stub", 0, (path) =>
      path === "assets/hero.jpg" ? "blob:hero-preview" : undefined,
    );

    expect(html).toContain('src="blob:hero-preview"');
    expect(html).not.toContain('src="assets/hero.jpg"');
  });
});
