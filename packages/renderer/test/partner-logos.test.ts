// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import axe from "axe-core";
import type { Site } from "@sosb/schema";
import partnerLogosFixture from "./fixtures/partner-logos.json" with { type: "json" };
import { renderSite } from "../src/index.js";

const fixture = partnerLogosFixture as unknown as Site;

/**
 * Renderer tests for the partnerLogos block — issue #17.
 *
 * Acceptance criteria from the issue map onto these tests:
 *  - validates and renders end-to-end
 *  - logo image alt is the AssetRef alt
 *  - optional URL renders as an anchor wrapping the logo with
 *    `aria-label` derived from the partner name
 *  - mandatory `name` even when only used for alt/aria
 *  - responsive: column count adapts to screen width via auto-fit/minmax
 *  - axe-core clean
 *  - SVG passthrough (#8) — SVG logos render with .svg src unchanged
 */
describe("renderSite — partnerLogos block (structural)", () => {
  test("renders a section with the partnerLogos block-id", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/<section[^>]*data-block="partnerLogos"/);
    expect(html).toMatch(/data-block-id="blk_partners_main"/);
  });

  test("renders the optional title as a heading inside the block", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/Partenerii noștri/);
  });

  test("renders one list item per partner", () => {
    const html = renderSite(fixture, "stub");
    const items = html.match(/<li[^>]*class="partner-logos__item"/g) ?? [];
    expect(items.length).toBe(3);
  });

  test("each logo image carries the AssetRef alt text", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toContain('alt="Acme Corp logo"');
    expect(html).toContain('alt="Beta University crest"');
    expect(html).toContain('alt="Gamma Foundation wordmark"');
  });

  test("each logo image points at the AssetRef path", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toContain('src="assets/8e3a7f.png"');
    expect(html).toContain('src="assets/4a91d2.svg"');
    expect(html).toContain('src="assets/c0ffee.webp"');
  });

  test("logo images are lazy-loaded (perf budget per PRD)", () => {
    const html = renderSite(fixture, "stub");
    const imgs = html.match(/<img[^>]*partner-logos__logo[^>]*>/g) ?? [];
    expect(imgs.length).toBe(3);
    for (const img of imgs) {
      expect(img).toMatch(/loading="lazy"/);
    }
  });

  test("SVG logos pass through unchanged — #8 contract", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/<img[^>]*src="assets\/4a91d2\.svg"/);
  });

  test("partners with a URL wrap the logo in an anchor with aria-label = name", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/<a[^>]*href="https:\/\/acme\.example\.com"[^>]*aria-label="Acme Corp"/);
    expect(html).toMatch(
      /<a[^>]*href="https:\/\/gamma\.example\.org"[^>]*aria-label="Gamma Foundation"/,
    );
  });

  test("anchored partners use rel noopener on outbound links (security baseline)", () => {
    const html = renderSite(fixture, "stub");
    const anchorMatch = /<a[^>]*href="https:\/\/acme\.example\.com"[^>]*>/.exec(html);
    expect(anchorMatch).not.toBeNull();
    if (anchorMatch !== null) {
      expect(anchorMatch[0]).toMatch(/rel="[^"]*noopener[^"]*"/);
    }
  });

  test("partners without a URL render the logo without an anchor wrapper", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toContain('src="assets/4a91d2.svg"');
    expect(html).not.toMatch(/<a[^>]*aria-label="Beta University"/);
  });

  test("the partner name still appears in the output even without a URL", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toContain("Beta University");
  });
});

describe("renderSite — partnerLogos forward-compat", () => {
  test("tolerates an unknown extra field on partner data", () => {
    const withExtra = structuredClone(fixture) as Site;
    const block = withExtra.pages[0]!.blocks[0]!;
    const partner = (block.data as { partners: Record<string, unknown>[] }).partners[0]!;
    partner.tier = "gold";
    const html = renderSite(withExtra, "stub");
    expect(html).toContain("Acme Corp logo");
  });
});

describe("renderSite — partnerLogos responsive CSS", () => {
  test("emits responsive grid CSS using auto-fit and minmax", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(
      /\.partner-logos__grid\s*\{[\s\S]*grid-template-columns:[\s\S]*auto-fit[\s\S]*minmax/,
    );
  });

  test("logos use a consistent display height while preserving aspect ratio", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/\.partner-logos__logo\s*\{[\s\S]*height:[\s\S]*\}/);
  });
});

describe("renderSite — partnerLogos axe-core accessibility", () => {
  test("partnerLogos sample with stub theme has zero axe violations", async () => {
    const html = renderSite(fixture, "stub");

    const langMatch = /<html[^>]*\blang="([^"]+)"/i.exec(html);
    const innerMatch = /<html[^>]*>([\s\S]*)<\/html>/i.exec(html);
    if (innerMatch === null) throw new Error("renderSite output missing <html> root");
    if (langMatch !== null && langMatch[1] !== undefined) {
      document.documentElement.setAttribute("lang", langMatch[1]);
    }
    document.documentElement.innerHTML = innerMatch[1] ?? "";

    const results = await axe.run(document, {
      rules: {
        "color-contrast": { enabled: false },
      },
    });

    expect(results.violations).toEqual([]);
  });
});

describe("renderSite — partnerLogos golden file (Academic stub)", () => {
  test("partnerLogos times stub-theme render matches its golden file", async () => {
    const html = renderSite(fixture, "stub");
    await expect(html).toMatchFileSnapshot("__golden__/stub-theme-partner-logos.html");
  });
});
