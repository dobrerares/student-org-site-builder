import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import heroOnly from "./fixtures/hero-only.json" with { type: "json" };
import { renderSite } from "../src/index.js";
import { ACADEMIC_THEME_ID } from "../src/themes/academic.js";

const fixture = heroOnly as unknown as Site;

/**
 * Academic theme — token + structural assertions.
 *
 * Visual / typographic taste is curated by the maintainer (issue #47 was
 * triaged `ready-for-human`). These tests pin the parts that can be checked
 * mechanically:
 *
 *   - the theme registers under its id and the renderer dispatches to it,
 *   - its tokens are emitted on `:root` with the documented palette,
 *   - block-level CSS still consumes tokens via `var(--token)` (no raw colour
 *     leakage outside `:root`),
 *   - the output stays deterministic and free of any client-side runtime.
 */

function rootBody(html: string): string {
  const m = /:root\s*\{([\s\S]*?)\}/.exec(html);
  if (m === null) throw new Error("expected a :root rule in renderer output");
  return m[1] ?? "";
}

function nonRootCss(html: string): string {
  const styleBlocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1] ?? "");
  return styleBlocks.join("\n").replace(/:root\s*\{[^}]*\}/g, "");
}

describe("academic theme — registration", () => {
  test("exposes a stable id constant", () => {
    expect(ACADEMIC_THEME_ID).toBe("academic");
  });

  test("renderSite dispatches to the academic theme when its id is passed", () => {
    const academicHtml = renderSite(fixture, "academic");
    const stubHtml = renderSite(fixture, "stub");
    // Different theme CSS implies different output. If the dispatch falls
    // through to the stub theme, this equality holds and the test fails.
    expect(academicHtml).not.toBe(stubHtml);
  });
});

describe("academic theme — palette tokens on :root", () => {
  // Scholarly recast: refined navy + library gold on a warm cream ground.
  test("declares an institutional navy as the primary colour", () => {
    const html = renderSite(fixture, "academic");
    expect(rootBody(html)).toMatch(/--color-primary:\s*#1e3a5f/);
  });

  test("declares a warm cream background", () => {
    const html = renderSite(fixture, "academic");
    expect(rootBody(html)).toMatch(/--color-bg:\s*#f7f3ea/);
  });

  test("declares a muted library gold accent", () => {
    const html = renderSite(fixture, "academic");
    expect(rootBody(html)).toMatch(/--color-accent:\s*#b8893e/);
  });

  test("declares an ink-dark foreground for body copy", () => {
    const html = renderSite(fixture, "academic");
    expect(rootBody(html)).toMatch(/--color-fg:\s*#1f2933/);
  });

  test("declares a slate-grey muted token for metadata text", () => {
    const html = renderSite(fixture, "academic");
    expect(rootBody(html)).toMatch(/--color-muted:\s*#5c6b7a/);
  });

  test("user theme tokens still override the academic baseline", () => {
    const overridden = structuredClone(fixture) as Site;
    overridden.theme = {
      id: "academic",
      tokens: { colorPrimary: "#000000", colorAccent: "#ffffff" },
    };
    const html = renderSite(overridden, "academic");
    const body = rootBody(html);
    const academicIdx = body.indexOf("#1e3a5f");
    const overrideIdx = body.lastIndexOf("#000000");
    expect(academicIdx).toBeGreaterThanOrEqual(0);
    expect(overrideIdx).toBeGreaterThan(academicIdx);
  });
});

describe("academic theme — typography tokens on :root", () => {
  // Scholarly recast: SERIF display (Source Serif 4) + SANS body (Inter). This
  // flips the legacy serif-throughout pairing — the academic voice now lives in
  // the Source Serif display, not in a manuscript-style serif body.
  test("declares a Source Serif 4 serif headline stack", () => {
    const html = renderSite(fixture, "academic");
    const body = rootBody(html);
    const allHeadline = [...body.matchAll(/--font-headline:\s*([^;]+);/g)].map((m) => m[1] ?? "");
    const last = allHeadline[allHeadline.length - 1] ?? "";
    expect(last).toMatch(/serif/);
    expect(last).toMatch(/Source Serif 4/);
  });

  test("declares an Inter sans-serif body stack", () => {
    const html = renderSite(fixture, "academic");
    const body = rootBody(html);
    const allBody = [...body.matchAll(/--font-body:\s*([^;]+);/g)].map((m) => m[1] ?? "");
    expect(allBody.length).toBeGreaterThan(0);
    const last = allBody[allBody.length - 1] ?? "";
    expect(last).toMatch(/Inter/);
    expect(last).toMatch(/sans-serif/);
  });

  test("comfortable density + soft radius ship via the engine knobs", () => {
    const html = renderSite(fixture, "academic");
    expect(rootBody(html)).toMatch(/--density-scale:\s*1\.15/);
    expect(rootBody(html)).toMatch(/--radius-base:\s*4px/);
  });

  test("self-hosts Source Serif 4 + Inter via @font-face (first family in each stack)", () => {
    const html = renderSite(fixture, "academic");
    expect(html).toMatch(/@font-face\s*\{[^}]*font-family:\s*"Source Serif 4"/);
    expect(html).toMatch(/@font-face\s*\{[^}]*font-family:\s*"Inter"/);
  });
});

describe("academic theme — token-only per-block CSS", () => {
  test("non-:root rules contain no raw hex / rgb colour values", () => {
    const html = renderSite(fixture, "academic");
    const css = nonRootCss(html);
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/\brgba?\(\s*[#0-9.]/);
    expect(css).toContain("var(--");
  });

  test("hero block heading uses var(--font-headline) (serif)", () => {
    const html = renderSite(fixture, "academic");
    const css = nonRootCss(html);
    expect(css).toMatch(
      /\[data-block="hero"\][\s\S]*?h1[\s\S]*?font-family:\s*var\(--font-headline\)/,
    );
  });

  test("body line-height is generous (>=1.6) for academic readability", () => {
    const html = renderSite(fixture, "academic");
    // The recast drops the bespoke `--leading-body` token in favour of a literal
    // generous body line-height (the engine owns the fluid type scale now). The
    // composed CSS has several `body { font-family: var(--font-body) }` blocks
    // (stub baseline at line-height 1.5, then the academic overlay) — the
    // academic rule is the LAST one (later wins per the cascade), so assert on it.
    const bodyDecls = [
      ...html.matchAll(/\bbody\s*\{[^}]*font-family:\s*var\(--font-body\)[^}]*\}/g),
    ];
    expect(bodyDecls.length).toBeGreaterThan(0);
    const academicBody = bodyDecls[bodyDecls.length - 1]![0];
    const lh = academicBody.match(/line-height:\s*([0-9]*\.?[0-9]+)/);
    expect(lh).not.toBeNull();
    expect(parseFloat(lh![1] ?? "0")).toBeGreaterThanOrEqual(1.6);
  });
});

describe("academic theme — determinism and zero-runtime", () => {
  test("repeated renders produce byte-identical output", () => {
    const a = renderSite(fixture, "academic");
    const b = renderSite(fixture, "academic");
    expect(a).toBe(b);
  });

  test("ships no preact / react runtime tags", () => {
    const html = renderSite(fixture, "academic");
    expect(html).not.toMatch(/<script[^>]*src=[^>]*preact/i);
    expect(html).not.toMatch(/<script[^>]*src=[^>]*react/i);
  });

  test("renders a hero block with semantic markup", () => {
    const html = renderSite(fixture, "academic");
    expect(html).toMatch(/<section[^>]*data-block="hero"/);
    expect(html).toMatch(/<h1[^>]*>[\s\S]*Stub Org[\s\S]*<\/h1>/);
  });
});
