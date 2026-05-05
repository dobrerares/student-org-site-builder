import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import contactCardOnly from "./fixtures/contact-card-only.json" with { type: "json" };
import contactCardOsm from "./fixtures/contact-card-osm.json" with { type: "json" };
import { renderSite } from "../src/index.js";

/**
 * Golden-file regression for contactCard × stub theme (issue #13 AC).
 *
 * Two snapshots are kept:
 *  - `stub-theme-contact-card.html` — minimal contactCard, no map.
 *  - `stub-theme-contact-card-osm.html` — opted-in OSM map.
 *
 * The Academic theme variant lands when #47 + the per-block × per-theme
 * matrix lands; the stub-theme golden here is the regression contract for
 * the renderer's own structural HTML.
 */
describe("golden-file framework — stub theme + contactCard", () => {
  test("contactCard without map matches its golden file", async () => {
    const html = renderSite(contactCardOnly as unknown as Site, "stub");
    await expect(html).toMatchFileSnapshot("__golden__/stub-theme-contact-card.html");
  });

  test("contactCard with OSM map matches its golden file", async () => {
    const html = renderSite(contactCardOsm as unknown as Site, "stub");
    await expect(html).toMatchFileSnapshot("__golden__/stub-theme-contact-card-osm.html");
  });
});
