import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import cardsFixture from "./fixtures/activities-list-cards.json" with { type: "json" };
import listFixture from "./fixtures/activities-list-list.json" with { type: "json" };
import alternatingFixture from "./fixtures/activities-list-alternating.json" with { type: "json" };
import { renderSite } from "../src/index.js";

const cards = cardsFixture as unknown as Site;
const list = listFixture as unknown as Site;
const alternating = alternatingFixture as unknown as Site;

/**
 * Renderer tests for the `activitiesList` block.
 *
 * The renderer's job is structural: emit a `<section data-block=...>` with
 * a heading, an optional intro, and a list of items each carrying their
 * title, optional description, optional image (with mandatory alt), an
 * optional link rendered as an accessible CTA, and an optional badge.
 *
 * Layout selection is exposed via `data-layout="cards|list|alternating"`
 * so theme CSS can target each layout without changing the markup.
 */

describe("renderSite — activitiesList block (structural)", () => {
  test("renders a <section> with data-block and data-layout attributes", () => {
    const html = renderSite(cards, "stub");
    expect(html).toMatch(/<section[^>]*data-block="activitiesList"/);
    expect(html).toMatch(/<section[^>]*data-layout="cards"/);
  });

  test("renders the block title as an h2 inside the section", () => {
    const html = renderSite(cards, "stub");
    expect(html).toMatch(
      /<section[^>]*data-block="activitiesList"[\s\S]*<h2[^>]*>[\s\S]*Activitățile noastre[\s\S]*<\/h2>/,
    );
  });

  test("renders the optional intro paragraph when present", () => {
    const html = renderSite(cards, "stub");
    expect(html).toContain("Ce facem pe parcursul anului.");
  });

  test("omits the intro paragraph when not provided", () => {
    const html = renderSite(list, "stub");
    expect(html).not.toContain("Ce facem pe parcursul anului.");
  });

  test("renders each item's title and description", () => {
    const html = renderSite(cards, "stub");
    expect(html).toContain("Conferința de toamnă");
    expect(html).toContain("Eveniment anual academic.");
    expect(html).toContain("Workshop lunar");
    expect(html).toContain("Sesiuni practice cu invitați.");
  });

  test("renders an item image with its alt text and src", () => {
    const html = renderSite(cards, "stub");
    expect(html).toContain('alt="Studenți la conferință"');
    expect(html).toContain("assets/8e3a7f9b1c0d2e4f.jpg");
  });

  test("never emits an empty alt on a rendered <img> in this block", () => {
    for (const fixture of [cards, list, alternating]) {
      const html = renderSite(fixture, "stub");
      const sectionMatch =
        /<section[^>]*data-block="activitiesList"[^>]*>([\s\S]*?)<\/section>/.exec(html);
      if (sectionMatch === null) continue;
      const inner = sectionMatch[1] ?? "";
      const altRegex = /<img[^>]*\salt="([^"]*)"/g;
      let m: RegExpExecArray | null;
      while ((m = altRegex.exec(inner)) !== null) {
        expect(m[1]?.length ?? 0).toBeGreaterThan(0);
      }
    }
  });

  test("renders a per-item link as an accessible CTA with the supplied label", () => {
    const html = renderSite(cards, "stub");
    expect(html).toMatch(/<a[^>]*href="\/conferinta"[^>]*>[\s\S]*Detalii[\s\S]*<\/a>/);
  });

  test("renders a per-item link without label as an accessible CTA with an accessible name", () => {
    const html = renderSite(list, "stub");
    const anchorMatch = /<a[^>]*href="\/conferinte"[^>]*>([\s\S]*?)<\/a>/.exec(html);
    expect(anchorMatch).not.toBeNull();
    if (anchorMatch !== null) {
      const fullTag = anchorMatch[0]!;
      const inner = anchorMatch[1] ?? "";
      const hasText = inner.replace(/<[^>]*>/g, "").trim().length > 0;
      const hasAriaLabel = /\baria-label="[^"]+"/.test(fullTag);
      expect(hasText || hasAriaLabel).toBe(true);
    }
  });

  test("renders a badge with a distinct class for theme-token styling", () => {
    const html = renderSite(cards, "stub");
    expect(html).toMatch(/class="[^"]*activities-list__badge[^"]*"[^>]*>[\s\S]*Anual/);
    expect(html).toMatch(/class="[^"]*activities-list__badge[^"]*"[^>]*>[\s\S]*Lunar/);
  });

  test('list layout renders with data-layout="list"', () => {
    const html = renderSite(list, "stub");
    expect(html).toMatch(/<section[^>]*data-layout="list"/);
  });

  test('alternating layout renders with data-layout="alternating"', () => {
    const html = renderSite(alternating, "stub");
    expect(html).toMatch(/<section[^>]*data-layout="alternating"/);
  });

  test("renders deterministically across repeated calls", () => {
    const a = renderSite(cards, "stub");
    const b = renderSite(cards, "stub");
    expect(a).toBe(b);
  });

  test("tolerates an unknown extra field on item data (forward-compat)", () => {
    const fixture = structuredClone(cards) as Site;
    const block = fixture.pages[0]!.blocks[0]!;
    const items = (block.data as { items: Record<string, unknown>[] }).items;
    items[0]!.experimentalField = "ignored-ok";
    const html = renderSite(fixture, "stub");
    expect(html).toContain("Conferința de toamnă");
  });
});

describe("renderSite — activitiesList CSS tokens", () => {
  test("activitiesList CSS uses var(--token) and never raw hex/rgb (outside :root)", () => {
    const html = renderSite(cards, "stub");
    const styleBlocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]!);
    const nonRootRules = styleBlocks.join("\n").replace(/:root\s*\{[^}]*\}/g, "");
    expect(nonRootRules).toContain("activities-list");
    expect(nonRootRules).toContain("var(--");
    expect(nonRootRules).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(nonRootRules).not.toMatch(/\brgb\(/);
  });
});
