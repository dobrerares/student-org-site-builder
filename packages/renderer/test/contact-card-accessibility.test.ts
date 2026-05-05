// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import axe from "axe-core";
import type { Site } from "@sosb/schema";
import contactCardOnly from "./fixtures/contact-card-only.json" with { type: "json" };
import contactCardOsm from "./fixtures/contact-card-osm.json" with { type: "json" };
import { renderSite } from "../src/index.js";

const fixture = contactCardOnly as unknown as Site;
const osmFixture = contactCardOsm as unknown as Site;

async function runAxeOnHtml(html: string): Promise<axe.Result[]> {
  const langMatch = /<html[^>]*\blang="([^"]+)"/i.exec(html);
  const innerMatch = /<html[^>]*>([\s\S]*)<\/html>/i.exec(html);
  if (innerMatch === null) throw new Error("renderSite output missing <html> root");
  if (langMatch !== null && langMatch[1] !== undefined) {
    document.documentElement.setAttribute("lang", langMatch[1]);
  }
  document.documentElement.innerHTML = innerMatch[1] ?? "";
  const results = await axe.run(document, {
    // Don't try to descend into iframes — jsdom doesn't load them and axe
    // would error trying to postMessage into a non-loaded frame. The
    // iframe's title and lazy-loading attribute are checked structurally
    // by the renderer test; axe-core only sees the host page here.
    iframes: false,
    rules: {
      "color-contrast": { enabled: false },
    },
  });
  return results.violations;
}

describe("renderSite — contactCard axe-core accessibility", () => {
  test("contactCard with no map has zero axe violations under stub theme", async () => {
    const html = renderSite(fixture, "stub");
    const violations = await runAxeOnHtml(html);
    expect(violations).toEqual([]);
  });

  test("contactCard with OSM iframe has zero axe violations under stub theme", async () => {
    const html = renderSite(osmFixture, "stub");
    const violations = await runAxeOnHtml(html);
    expect(violations).toEqual([]);
  });
});
