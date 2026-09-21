import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import fixtureJson from "./fixtures/articles.json" with { type: "json" };
import { KNOWN_THEME_IDS, renderSite } from "../src/index.js";

/**
 * Golden rows for Articles.
 *
 * Two shapes are captured per theme, because they exercise different code:
 * a Page carrying an `articleList` Block, and an Article page (which adds the
 * automatic header, tag list, and Related Articles section around the same
 * Block dispatch).
 */

const fixture = fixtureJson as unknown as Site;
const GALA_INDEX = (fixture.articles ?? []).findIndex((a) => a.id === "art_ro_gala");

describe("golden-file — articleList block", () => {
  test.each(KNOWN_THEME_IDS)("%s theme + articleList matches its golden file", async (themeId) => {
    const html = renderSite(fixture, themeId, { pageIndex: 0 });
    await expect(html).toMatchFileSnapshot(`__golden__/${themeId}-theme-article-list.html`);
  });
});

describe("golden-file — article page", () => {
  test.each(KNOWN_THEME_IDS)("%s theme + article page matches its golden file", async (themeId) => {
    const html = renderSite(fixture, themeId, { articleIndex: GALA_INDEX });
    await expect(html).toMatchFileSnapshot(`__golden__/${themeId}-theme-article-page.html`);
  });
});
