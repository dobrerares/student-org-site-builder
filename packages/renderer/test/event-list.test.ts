import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import eventListOnly from "./fixtures/event-list-only.json" with { type: "json" };
import { renderSite } from "../src/index.js";

const fixture = eventListOnly as unknown as Site;

/**
 * eventList renderer tests.
 *
 * The renderer:
 *  - emits a `<section data-block="event-list">` wrapper carrying the
 *    `data-past-behavior` attribute,
 *  - sorts the events deterministically at build time (no `Date.now()`),
 *  - emits one `<article data-event-id data-starts-at>` per event with a
 *    `<time datetime=...>` child for the machine-readable start,
 *  - inlines a single self-contained `<script>` at end-of-body that toggles
 *    `is-past` / removes past events at render time (vanilla JS, see
 *    `event-list-past-fade.test.ts` for the script's unit tests).
 *
 * The script is *only* emitted when at least one eventList block is present
 * on the page; pages with no event list ship zero JS, preserving the
 * "static HTML only" contract for those builds.
 */

describe("renderSite — eventList block", () => {
  test("emits a section with data-block='event-list' and the configured past-behavior", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/<section[^>]*data-block="event-list"[^>]*>/);
    expect(html).toMatch(/data-past-behavior="fade"/);
  });

  test("renders the optional title and intro when present", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toContain("Evenimente");
    expect(html).toContain("Activitățile din acest an universitar.");
  });

  test("renders one <article data-event-id> per event entry", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toContain('data-event-id="ev_2025_winter"');
    expect(html).toContain('data-event-id="ev_2026_spring"');
    expect(html).toContain('data-event-id="ev_2026_summer"');
  });

  test("emits the startsAt as both data-starts-at and a <time datetime=...>", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toContain('data-starts-at="2025-12-10T18:00:00+02:00"');
    expect(html).toMatch(/<time[^>]*datetime="2025-12-10T18:00:00\+02:00"/);
  });

  test("renders optional event fields (description, image, location, url)", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toContain("Hands-on cu surse de arhivă.");
    expect(html).toContain("assets/atelier.jpg");
    expect(html).toContain("Sala 3.4");
    expect(html).toMatch(/<a[^>]*href="https:\/\/historipol\.ro\/conferinta"/);
  });

  test("applies the date-asc sort by default (earliest first)", () => {
    const html = renderSite(fixture, "stub");
    const winterIdx = html.indexOf("ev_2025_winter");
    const springIdx = html.indexOf("ev_2026_spring");
    const summerIdx = html.indexOf("ev_2026_summer");
    expect(winterIdx).toBeGreaterThan(0);
    expect(springIdx).toBeGreaterThan(winterIdx);
    expect(summerIdx).toBeGreaterThan(springIdx);
  });

  test("applies date-desc when configured (latest first)", () => {
    const desc = structuredClone(fixture) as Site;
    (desc.pages[0]!.blocks[0]!.data as Record<string, unknown>).sortBy = "date-desc";
    const html = renderSite(desc, "stub");
    const winterIdx = html.indexOf("ev_2025_winter");
    const summerIdx = html.indexOf("ev_2026_summer");
    expect(summerIdx).toBeGreaterThan(0);
    expect(summerIdx).toBeLessThan(winterIdx);
  });

  test("defaults pastBehavior to 'fade' when omitted from data", () => {
    const minimal = structuredClone(fixture) as Site;
    delete (minimal.pages[0]!.blocks[0]!.data as Record<string, unknown>).pastBehavior;
    const html = renderSite(minimal, "stub");
    expect(html).toMatch(/data-past-behavior="fade"/);
  });

  test("defaults sortBy to 'date-asc' when omitted from data", () => {
    const minimal = structuredClone(fixture) as Site;
    delete (minimal.pages[0]!.blocks[0]!.data as Record<string, unknown>).sortBy;
    const html = renderSite(minimal, "stub");
    const winterIdx = html.indexOf("ev_2025_winter");
    const summerIdx = html.indexOf("ev_2026_summer");
    expect(summerIdx).toBeGreaterThan(winterIdx);
  });

  test("renders an empty list cleanly when events: []", () => {
    const empty = structuredClone(fixture) as Site;
    (empty.pages[0]!.blocks[0]!.data as Record<string, unknown>).events = [];
    // Must not throw and must still emit the wrapper section.
    const html = renderSite(empty, "stub");
    expect(html).toMatch(/<section[^>]*data-block="event-list"/);
  });

  test("emits a single inlined past-fade <script> tag at end of body when an eventList exists", () => {
    const html = renderSite(fixture, "stub");
    const scriptMatches = html.match(/<script[^>]*data-sosb="event-list-past-fade"/g) ?? [];
    expect(scriptMatches.length).toBe(1);
  });

  test("does not emit the past-fade <script> on pages without an eventList", () => {
    // Swap the eventList for a hero block.
    const heroOnly = structuredClone(fixture) as Site;
    heroOnly.pages[0]!.blocks = [
      {
        id: "blk_hero_only",
        type: "hero",
        version: 1,
        data: { title: "Just a hero" },
      },
    ];
    const html = renderSite(heroOnly, "stub");
    expect(html).not.toContain('data-sosb="event-list-past-fade"');
  });

  test("the past-fade <script> contents are deterministic (no Date.now / random)", () => {
    const a = renderSite(fixture, "stub");
    const b = renderSite(fixture, "stub");
    expect(a).toBe(b);
    // Spot-check: nothing in the script source should look like an inlined
    // build-time timestamp.
    expect(a).not.toMatch(/\bbuiltAt\b/);
    // The script must NOT contain a literal milliseconds-since-epoch number
    // close to a build date — that would mean we baked the "now" into the
    // output, breaking the static-and-deterministic contract.
    expect(a).not.toMatch(/\b1[7-9]\d{11}\b/);
  });

  test("renderSite output stays byte-identical across repeat calls (eventList determinism)", () => {
    const a = renderSite(fixture, "stub");
    const b = renderSite(fixture, "stub");
    const c = renderSite(structuredClone(fixture), "stub");
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  test("preserves unknown extra fields on event-list data without throwing", () => {
    const withExtra = structuredClone(fixture) as Site;
    (withExtra.pages[0]!.blocks[0]!.data as Record<string, unknown>).futureField = "ignored-ok";
    const html = renderSite(withExtra, "stub");
    expect(html).toContain("Evenimente");
  });

  test("does not ship any Preact/React runtime in the output", () => {
    const html = renderSite(fixture, "stub");
    expect(html).not.toMatch(/<script[^>]*src=[^>]*preact/i);
    expect(html).not.toMatch(/<script[^>]*src=[^>]*react/i);
  });

  test("the past-fade script source is under 1.5kb minified-ish (1500 bytes raw)", () => {
    const html = renderSite(fixture, "stub");
    const scriptMatch = html.match(
      /<script[^>]*data-sosb="event-list-past-fade"[^>]*>([\s\S]*?)<\/script>/,
    );
    expect(scriptMatch).not.toBeNull();
    const scriptBody = scriptMatch![1] ?? "";
    // The PRD budgets the past-fade script at <1.5kb minified. Our shipped
    // string is hand-written and minimal; we assert the un-gzipped raw body
    // stays under 1500 bytes so any future bloat surfaces in CI.
    expect(scriptBody.length).toBeLessThan(1500);
  });
});

describe("renderSite — eventList golden file", () => {
  test("event-list-only stub-theme render matches its golden file", async () => {
    const html = renderSite(fixture, "stub");
    await expect(html).toMatchFileSnapshot("__golden__/stub-theme-event-list.html");
  });
});
