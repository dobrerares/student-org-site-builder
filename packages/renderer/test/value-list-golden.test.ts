import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import valueListOnly from "./fixtures/value-list-only.json" with { type: "json" };
import { renderSite } from "../src/index.js";

const fixture = valueListOnly as unknown as Site;

/**
 * Golden-file regression for valueList × stub theme.
 *
 * Per the issue's AC: "Golden-file test for valueList × Academic theme."
 * The Academic theme lives in #47 / #28-#31; this package only ships the
 * stub theme today. We stand up the golden file with the stub theme so the
 * regression contract exists, and #47/#28-#31 will add the Academic-theme
 * variant when those land.
 */
describe("golden-file framework — stub theme + valueList", () => {
  test("valueList stub-theme render matches its golden file", async () => {
    const html = renderSite(fixture, "stub");
    await expect(html).toMatchFileSnapshot("__golden__/stub-theme-value-list.html");
  });
});
