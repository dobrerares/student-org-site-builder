import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import heroOnlyEditorial from "./fixtures/hero-only-editorial.json" with { type: "json" };
import { renderSite } from "../src/index.js";
import { EDITORIAL_THEME_ID } from "../src/themes/editorial.js";

const fixture = heroOnlyEditorial as unknown as Site;

/**
 * Hero golden for the Editorial theme — issue #29.
 *
 * Per the issue contract, v1 ships token emission + a hero golden;
 * per-block × per-theme goldens are deferred until the full block matrix
 * lands (#9-#22 alongside the other themes #28/#30/#31/#47).
 */

describe("golden-file — editorial theme + hero", () => {
  test("hero-only editorial-theme render matches its golden file", async () => {
    const html = renderSite(fixture, EDITORIAL_THEME_ID);
    await expect(html).toMatchFileSnapshot("__golden__/editorial-theme-hero.html");
  });
});
