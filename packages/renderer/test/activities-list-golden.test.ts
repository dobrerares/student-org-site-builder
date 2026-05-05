import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import cardsFixture from "./fixtures/activities-list-cards.json" with { type: "json" };
import listFixture from "./fixtures/activities-list-list.json" with { type: "json" };
import alternatingFixture from "./fixtures/activities-list-alternating.json" with { type: "json" };
import { renderSite } from "../src/index.js";

/**
 * Golden-file coverage for activitiesList × Academic theme.
 *
 * Per the issue triage decision (issue #11 AC), the block ships golden
 * files for each layout × the Academic theme. The full Academic theme is
 * issue #47; until it lands, the renderer falls back to the stub theme,
 * which is what the existing golden-file framework already exercises in
 * `golden-file.test.ts`. We use the stub theme here so the framework is
 * wired and the goldens are committed; they will regenerate against the
 * Academic theme when #47 substitutes the CSS for `themeId === "academic"`.
 *
 * Three goldens, one per layout. Drift in any of them fails CI.
 */

const cases: Array<{ layout: "cards" | "list" | "alternating"; site: Site }> = [
  { layout: "cards", site: cardsFixture as unknown as Site },
  { layout: "list", site: listFixture as unknown as Site },
  { layout: "alternating", site: alternatingFixture as unknown as Site },
];

describe("golden-file framework — activitiesList × Academic-stub", () => {
  for (const { layout, site } of cases) {
    test(`activitiesList ${layout} render matches its golden file`, async () => {
      const html = renderSite(site, "academic");
      await expect(html).toMatchFileSnapshot(
        `__golden__/activities-list-${layout}-academic-stub.html`,
      );
    });
  }
});
