// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import axe from "axe-core";
import type { Site } from "@sosb/schema";
import fixtureJson from "./fixtures/articles.json" with { type: "json" };
import { KNOWN_THEME_IDS, renderSite } from "../src/index.js";

const fixture = fixtureJson as unknown as Site;
const GALA_INDEX = (fixture.articles ?? []).findIndex((a) => a.id === "art_ro_gala");

async function runAxeOn(html: string): Promise<axe.Result[]> {
  const langMatch = /<html[^>]*\blang="([^"]+)"/i.exec(html);
  const innerMatch = /<html[^>]*>([\s\S]*)<\/html>/i.exec(html);
  if (innerMatch === null) throw new Error("renderSite output missing <html> root");
  if (langMatch !== null && langMatch[1] !== undefined) {
    document.documentElement.setAttribute("lang", langMatch[1]);
  }
  document.documentElement.innerHTML = innerMatch[1] ?? "";
  const results = await axe.run(document, {
    rules: { "color-contrast": { enabled: false } },
  });
  return results.violations;
}

describe("renderSite axe-core accessibility — Articles", () => {
  test.each(KNOWN_THEME_IDS)("article page under %s has zero axe violations", async (themeId) => {
    expect(await runAxeOn(renderSite(fixture, themeId, { articleIndex: GALA_INDEX }))).toEqual([]);
  });

  test.each(KNOWN_THEME_IDS)("articleList under %s has zero axe violations", async (themeId) => {
    expect(await runAxeOn(renderSite(fixture, themeId, { pageIndex: 0 }))).toEqual([]);
  });

  test("an empty article list is still accessible", async () => {
    const empty = structuredClone(fixture);
    empty.articles = [];
    expect(await runAxeOn(renderSite(empty, "stub", { pageIndex: 0 }))).toEqual([]);
  });
});
