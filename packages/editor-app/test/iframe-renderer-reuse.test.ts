import { describe, expect, test } from "vitest";
import { renderSite } from "@sosb/renderer";
import type { Site } from "@sosb/schema";

import minimal from "./fixtures/minimal-site.json" with { type: "json" };
import { renderPreviewHtml } from "../src/preview-html.js";

const baseSite = minimal as unknown as Site;

/**
 * AC: the iframe preview uses the same renderer code as the build pipeline —
 * NO duplicate code path.
 *
 * This test asserts byte-equality between the editor's preview HTML and a
 * direct call to `renderSite()` from `@sosb/renderer`. If the editor ever
 * forks renderer logic (a localised string transform, an editor-only meta
 * tag, etc.) this test fails.
 */
describe("iframe preview reuses @sosb/renderer", () => {
  test("renderPreviewHtml byte-equals renderSite for the same input", () => {
    const direct = renderSite(baseSite, "stub");
    const preview = renderPreviewHtml(baseSite, "stub");
    expect(preview).toBe(direct);
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
});
