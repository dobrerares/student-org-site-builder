// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import axe from "axe-core";
import type { Site } from "@sosb/schema";
import cardsFixture from "./fixtures/activities-list-cards.json" with { type: "json" };
import listFixture from "./fixtures/activities-list-list.json" with { type: "json" };
import alternatingFixture from "./fixtures/activities-list-alternating.json" with { type: "json" };
import { renderSite } from "../src/index.js";

/**
 * axe-core accessibility coverage for the activitiesList block, mirroring
 * the hero-block accessibility test. Each of the three layouts must produce
 * zero structural axe violations.
 *
 * `color-contrast` is disabled because JSDOM does not compute styles —
 * visual contrast is enforced by per-theme tests (issue #47).
 */

const fixtures: Array<{ name: string; site: Site }> = [
  { name: "cards", site: cardsFixture as unknown as Site },
  { name: "list", site: listFixture as unknown as Site },
  { name: "alternating", site: alternatingFixture as unknown as Site },
];

describe("renderSite axe-core accessibility — activitiesList", () => {
  for (const { name, site } of fixtures) {
    test(`activitiesList (${name}) has zero axe violations under stub theme`, async () => {
      const html = renderSite(site, "stub");
      const langPattern = /<html[^>]*\blang="([^"]+)"/i;
      const innerPattern = /<html[^>]*>([\s\S]*)<\/html>/i;
      const langMatch = langPattern.exec(html);
      const innerMatch = innerPattern.exec(html);
      if (innerMatch === null) throw new Error("renderSite output missing <html> root");
      if (langMatch !== null && langMatch[1] !== undefined) {
        document.documentElement.setAttribute("lang", langMatch[1]);
      }
      document.documentElement.innerHTML = innerMatch[1] ?? "";

      const results = await axe.run(document, {
        rules: { "color-contrast": { enabled: false } },
      });

      expect(results.violations).toEqual([]);
    });
  }
});
