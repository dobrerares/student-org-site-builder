import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import ctaFixture from "./fixtures/cta-banner-only.json" with { type: "json" };
import { renderSite } from "../src/index.js";

const fixture = ctaFixture as unknown as Site;

describe("renderSite — ctaBanner block (structural)", () => {
  test("renders a <section> with data-block=ctaBanner", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/<section[^>]*data-block="ctaBanner"/);
  });

  test("renders the headline as an <h2> (not <h1> — there is already a hero <h1>)", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/<h2[^>]*>[\s\S]*Alătură-te HISTORIPOL[\s\S]*<\/h2>/);
  });

  test("renders the subtitle when present", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toContain("Recrutarea anuală este deschisă până pe 15 octombrie.");
  });

  test("renders an accessible button as an <a> with the label and URL", () => {
    const html = renderSite(fixture, "stub");
    // The "button" is a link styled as a button — anchored to the URL.
    expect(html).toMatch(/<a[^>]*href="https:\/\/historipol\.ro\/aplica"[^>]*>[^<]*Aplică acum/);
  });

  test("the CTA link carries the primary style class", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/<a[^>]*class="[^"]*ctaBanner__button--primary/);
  });

  test("background image renders with the asset path and alt text", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toContain("assets/8e3a7f9b1c0d2e4f.jpg");
    expect(html).toContain('alt="Studenți la un eveniment de recrutare"');
  });

  test("section is labelled by the headline for screen readers", () => {
    const html = renderSite(fixture, "stub");
    // The <section> uses aria-labelledby pointing at the headline's id.
    expect(html).toMatch(
      /<section[^>]*data-block="ctaBanner"[^>]*aria-labelledby="blk_home_cta__title"/,
    );
    expect(html).toMatch(/id="blk_home_cta__title"/);
  });

  test("section's outbound link is keyboard-discoverable (has a real href, not a click handler)", () => {
    const html = renderSite(fixture, "stub");
    // No onclick, no role=button-only-anchor; just <a href>.
    expect(html).not.toMatch(/onclick=/i);
    expect(html).not.toMatch(/<button[^>]*data-block-id="blk_home_cta"/);
  });
});

describe("renderSite — ctaBanner without background image", () => {
  test("renders without the media element when backgroundImage is omitted", () => {
    const minimal = structuredClone(fixture) as Site;
    const block = minimal.pages[0]!.blocks[1]!.data as Record<string, unknown>;
    delete block.backgroundImage;
    const html = renderSite(minimal, "stub");
    expect(html).toMatch(/<section[^>]*data-block="ctaBanner"/);
    expect(html).not.toContain("assets/8e3a7f9b1c0d2e4f.jpg");
    // Section MUST still emit a class hook for the solid-color fallback so
    // theme CSS can target it.
    expect(html).toMatch(/<section[^>]*data-block="ctaBanner"[^>]*class="[^"]*ctaBanner--solid/);
  });
});

describe("renderSite — ctaBanner secondary style", () => {
  test("renders the button with the secondary class when style is 'secondary'", () => {
    const withSecondary = structuredClone(fixture) as Site;
    const data = withSecondary.pages[0]!.blocks[1]!.data as {
      button: { style: string };
    };
    data.button.style = "secondary";
    const html = renderSite(withSecondary, "stub");
    expect(html).toMatch(/<a[^>]*class="[^"]*ctaBanner__button--secondary/);
    expect(html).not.toMatch(/<a[^>]*class="[^"]*ctaBanner__button--primary/);
  });
});

describe("renderSite — ctaBanner determinism", () => {
  test("produces byte-identical output on repeated renders", () => {
    const a = renderSite(fixture, "stub");
    const b = renderSite(fixture, "stub");
    expect(a).toBe(b);
  });

  test("tolerates an unknown extra field on cta data (forward-compat)", () => {
    const withExtra = structuredClone(fixture) as Site;
    (withExtra.pages[0]!.blocks[1]!.data as Record<string, unknown>).futureField = "ignored-ok";
    const html = renderSite(withExtra, "stub");
    expect(html).toContain("Alătură-te HISTORIPOL");
  });
});
