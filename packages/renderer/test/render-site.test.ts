import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import heroOnly from "./fixtures/hero-only.json" with { type: "json" };
import { renderSite } from "../src/index.js";

const fixture = heroOnly as unknown as Site;

describe("renderSite — page shell", () => {
  test("returns a full HTML document with html/head/body", () => {
    const html = renderSite(fixture, "stub");
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<html");
    expect(html).toContain("<head>");
    expect(html).toContain("</head>");
    expect(html).toContain("<body");
    expect(html).toContain("</body>");
    expect(html).toContain("</html>");
  });

  test("sets the document language to the page's lang", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/<html[^>]*lang="ro"/);
  });

  test("sets a charset meta tag", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toContain('<meta charset="utf-8"');
  });

  test("emits a viewport meta tag", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/<meta name="viewport"[^>]*width=device-width/);
  });

  test("emits the page SEO title and description", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toContain("<title>Stub site — home</title>");
    expect(html).toMatch(/<meta name="description" content="A minimal site for renderer tests\."/);
  });

  test("falls back to org.name when no page title is set", () => {
    const noTitleSite = structuredClone(fixture) as Site;
    delete (noTitleSite.pages[0]!.seo as { title?: string }).title;
    const html = renderSite(noTitleSite, "stub");
    expect(html).toContain("<title>Stub Org</title>");
  });
});

describe("renderSite — determinism", () => {
  test("produces byte-identical output across repeated calls with the same input", () => {
    const a = renderSite(fixture, "stub");
    const b = renderSite(fixture, "stub");
    const c = renderSite(fixture, "stub");
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  test("produces byte-identical output with a structurally-cloned input", () => {
    const a = renderSite(fixture, "stub");
    const b = renderSite(structuredClone(fixture), "stub");
    expect(a).toBe(b);
  });

  test("never embeds Date.now() / random IDs in the output", () => {
    const html = renderSite(fixture, "stub");
    // Check that the same call repeated within a single session produces the same string —
    // any non-deterministic source (Date.now, Math.random, performance.now, crypto.randomUUID)
    // would surface as drift across two consecutive calls.
    const again = renderSite(fixture, "stub");
    expect(html).toBe(again);
    // Spot-check: no obvious timestamp-like patterns.
    expect(html).not.toMatch(/data-render-time/);
    expect(html).not.toMatch(/data-uid="[a-f0-9]{8,}/);
  });
});

describe("renderSite — tokens-as-CSS-custom-properties", () => {
  test("emits a :root selector with --color-primary and --color-accent custom properties", () => {
    const html = renderSite(fixture, "stub");
    // Loose match: the :root rule must declare both tokens, in some form.
    expect(html).toMatch(/:root\s*\{[^}]*--color-primary:\s*#1f3a5f/);
    expect(html).toMatch(/:root\s*\{[^}]*--color-accent:\s*#c08a3e/);
  });

  test("emits spacing/radius default tokens for blocks to consume", () => {
    const html = renderSite(fixture, "stub");
    // The renderer's stub theme contributes baseline tokens (space, radius) so
    // per-block styles can reference them via var(); the schema only carries
    // colour and font tokens by design.
    expect(html).toMatch(/--space-md:/);
    expect(html).toMatch(/--radius-sm:/);
  });

  test("per-block CSS references var(--...) and never hardcodes hex/rgb colours", () => {
    const html = renderSite(fixture, "stub");
    // Extract every <style> block — block-level styles live there.
    const styleBlocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]!);
    // The :root block legitimately holds raw colour values (it _defines_ the
    // tokens); every _other_ rule must consume them via var().
    const nonRootRules = styleBlocks.join("\n").replace(/:root\s*\{[^}]*\}/g, "");
    expect(nonRootRules).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(nonRootRules).not.toMatch(/\brgb\(/);
    expect(nonRootRules).not.toMatch(/\brgba\(/);
    // And per-block styles must actually reference the tokens.
    expect(nonRootRules).toContain("var(--");
  });

  test("does not ship any Preact/React runtime in the output", () => {
    const html = renderSite(fixture, "stub");
    // No <script> tags from a hydration runtime, no preact module references.
    expect(html).not.toMatch(/<script[^>]*src=[^>]*preact/i);
    expect(html).not.toMatch(/<script[^>]*src=[^>]*react/i);
    // No JSX-ish leftovers.
    expect(html).not.toMatch(/__html\b/);
  });
});

describe("renderSite — hero block (structural)", () => {
  test("renders a <section> with the hero role and headline", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/<section[^>]*data-block="hero"/);
    expect(html).toContain("Stub Org");
    expect(html).toContain("A fixture for renderer tests");
  });

  test("hero with a background image marks the section and layers media before the lockup", () => {
    const html = renderSite(fixture, "stub");
    // The hero fixture (hero-only.json) carries a backgroundImage.
    expect(html).toMatch(/<section[^>]*data-block="hero"[^>]*class="hero hero--has-image"/);
    // Media comes before the lockup so it can sit behind the text.
    const mediaIdx = html.indexOf('class="hero__media"');
    const innerIdx = html.indexOf('class="hero__inner"');
    expect(mediaIdx).toBeGreaterThan(-1);
    expect(innerIdx).toBeGreaterThan(mediaIdx);
    // Eyebrow is gone from the rendered markup. (The theme stylesheet in <head>
    // may still carry an orphaned .hero__eyebrow selector until a later CSS task
    // prunes it, so scope the assertion to the document body.)
    const body = html.slice(html.indexOf("<body"));
    expect(body).not.toContain("hero__eyebrow");
  });

  test("renders the hero title inside an <h1>", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/<h1[^>]*>[\s\S]*Stub Org[\s\S]*<\/h1>/);
  });

  test("renders backgroundImage with backgroundAlt as semantic <img alt=...>", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toContain('alt="Studenți la o conferință"');
    expect(html).toContain("assets/hero.jpg");
  });

  test("tolerates an unknown extra field on hero data (forward-compat)", () => {
    const withExtra = structuredClone(fixture) as Site;
    (withExtra.pages[0]!.blocks[0]!.data as Record<string, unknown>).futureField = "ignored-ok";
    // Must not throw, must still render, must still contain the title.
    const html = renderSite(withExtra, "stub");
    expect(html).toContain("Stub Org");
  });

  test("tolerates a hero with only the required title", () => {
    const minimal = structuredClone(fixture) as Site;
    minimal.pages[0]!.blocks[0]!.data = { title: "Just a title" };
    const html = renderSite(minimal, "stub");
    expect(html).toContain("Just a title");
  });
});

describe("renderSite — unknown blocks (forward-compat)", () => {
  test("renders an HTML comment placeholder for unknown block types", () => {
    const withUnknown = structuredClone(fixture) as Site;
    withUnknown.pages[0]!.blocks.push({
      id: "blk_unknown_1",
      type: "futureBlock",
      version: 1,
      data: { foo: "bar" },
    });
    const html = renderSite(withUnknown, "stub");
    expect(html).toContain("<!-- unknown block: futureBlock -->");
  });
});
