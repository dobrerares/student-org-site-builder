import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import valueListOnly from "./fixtures/value-list-only.json" with { type: "json" };
import { renderSite } from "../src/index.js";

const fixture = valueListOnly as unknown as Site;

describe("renderSite — valueList block (structural)", () => {
  test("renders a <section> with the valueList data-block marker", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/<section[^>]*data-block="valueList"/);
  });

  test("uses the schema-supplied block id as data-block-id", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toContain('data-block-id="blk_home_values"');
  });

  test("renders the optional title as an <h2>", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/<h2[^>]*>[\s\S]*Valorile noastre[\s\S]*<\/h2>/);
  });

  test("renders the optional intro paragraph", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toContain("Principiile care ne ghidează activitatea zi de zi.");
  });

  test("renders the items as a <ul> with one <li> per item", () => {
    const html = renderSite(fixture, "stub");
    // <ul> wraps the items
    expect(html).toMatch(/<ul[^>]*class="value-list__items"/);
    // Three <li>s for three items
    const itemMatches = html.match(/<li[^>]*class="value-list__item"/g) ?? [];
    expect(itemMatches.length).toBe(3);
  });

  test("renders each item label inside an <h3>", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/<h3[^>]*>[\s\S]*Comunitate[\s\S]*<\/h3>/);
    expect(html).toMatch(/<h3[^>]*>[\s\S]*Curiozitate[\s\S]*<\/h3>/);
    expect(html).toMatch(/<h3[^>]*>[\s\S]*Integritate[\s\S]*<\/h3>/);
  });

  test("renders each description as a <p>", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toContain("Construim un spațiu sigur pentru fiecare student.");
    expect(html).toContain("Învățăm împreună, fără ierarhii.");
    expect(html).toContain("Spunem ce credem și facem ce spunem.");
  });

  test("renders curated icons as inline aria-hidden <svg>", () => {
    const html = renderSite(fixture, "stub");
    // Icons must be aria-hidden because the label conveys the meaning.
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
    // The data-icon attribute carries the icon name for theme hooks / tests.
    expect(html).toContain('data-icon="users"');
    expect(html).toContain('data-icon="lightbulb"');
    expect(html).toContain('data-icon="scale"');
  });

  test("encodes layout and columns as data-attributes for theme styling", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/data-layout="grid"/);
    expect(html).toMatch(/data-columns="3"/);
  });

  test("section has aria-labelledby pointing at the title heading id", () => {
    const html = renderSite(fixture, "stub");
    // When a title is present, aria-labelledby points at the <h2>.
    expect(html).toMatch(/aria-labelledby="blk_home_values__title"/);
    expect(html).toMatch(/id="blk_home_values__title"/);
  });

  test("omits aria-labelledby when there is no title", () => {
    const noTitle = structuredClone(fixture) as Site;
    const data = noTitle.pages[0]!.blocks[0]!.data as Record<string, unknown>;
    delete data.title;
    const html = renderSite(noTitle, "stub");
    // No aria-labelledby on the section, no title <h2>.
    expect(html).not.toMatch(/data-block="valueList"[^>]*aria-labelledby/);
    expect(html).not.toMatch(/<h2[^>]*id="blk_home_values__title"/);
  });

  test("tolerates an item with no icon and no description", () => {
    const minimal = structuredClone(fixture) as Site;
    minimal.pages[0]!.blocks[0]!.data.items = [{ label: "Doar etichetă" }];
    const html = renderSite(minimal, "stub");
    expect(html).toContain("Doar etichetă");
    // Single item, single <li>.
    const itemMatches = html.match(/<li[^>]*class="value-list__item"/g) ?? [];
    expect(itemMatches.length).toBe(1);
  });

  test("tolerates unknown icon names without throwing (forward-compat)", () => {
    const future = structuredClone(fixture) as Site;
    // Bypass the schema by mutating after parse — simulates a future editor
    // having added a new icon to the curated set that older renderers don't
    // know about.
    const items = future.pages[0]!.blocks[0]!.data.items as Array<Record<string, unknown>>;
    items[0]!.icon = "unknown-future-icon";
    // Must not throw, must still render the label text.
    const html = renderSite(future, "stub");
    expect(html).toContain("Comunitate");
    // Icon for the unknown name must NOT render an <svg> for it (no path).
    expect(html).not.toContain('data-icon="unknown-future-icon"');
  });

  test("tolerates an unknown extra field on data (forward-compat)", () => {
    const withExtra = structuredClone(fixture) as Site;
    (withExtra.pages[0]!.blocks[0]!.data as Record<string, unknown>).futureField = "ignored-ok";
    const html = renderSite(withExtra, "stub");
    expect(html).toContain("Valorile noastre");
  });
});

describe("renderSite — valueList determinism", () => {
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
});

describe("renderSite — valueList responsive (CSS)", () => {
  test("stub-theme CSS collapses the grid to a single column at narrow viewports", () => {
    const html = renderSite(fixture, "stub");
    // Extract <style> contents.
    const styleBlocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]!);
    const css = styleBlocks.join("\n");
    // A min-width media query that targets single-column on narrow screens
    // (or a grid template that uses minmax/auto-fit) — either is fine, both
    // are common idioms. The contract: a narrow viewport gets one column.
    const hasMediaSingle =
      /@media\s*\([^)]*max-width[^)]*\)\s*\{[^}]*grid-template-columns:\s*1fr/i.test(css);
    const hasAutoFitFallback = /grid-template-columns:\s*repeat\(auto-fit/i.test(css);
    expect(hasMediaSingle || hasAutoFitFallback).toBe(true);
  });

  test("per-block CSS continues to use only var(--token) for colours", () => {
    const html = renderSite(fixture, "stub");
    const styleBlocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]!);
    const nonRootRules = styleBlocks.join("\n").replace(/:root\s*\{[^}]*\}/g, "");
    expect(nonRootRules).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(nonRootRules).not.toMatch(/\brgb\(/);
    expect(nonRootRules).not.toMatch(/\brgba\(/);
  });
});
