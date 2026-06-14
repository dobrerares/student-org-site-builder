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
  test("declares an institutional dark navy as the primary colour", () => {
    const html = renderSite(fixture, "academic");
    expect(rootBody(html)).toMatch(/--color-primary:\s*#1a2440/);
  });

  test("declares a warm parchment background", () => {
    const html = renderSite(fixture, "academic");
    expect(rootBody(html)).toMatch(/--color-bg:\s*#f7f1e3/);
  });

  test("declares a muted gold accent", () => {
    const html = renderSite(fixture, "academic");
    expect(rootBody(html)).toMatch(/--color-accent:\s*#a67c2e/);
  });

  test("declares an ink-dark foreground for body copy", () => {
    const html = renderSite(fixture, "academic");
    expect(rootBody(html)).toMatch(/--color-fg:\s*#2a2418/);
  });

  test("declares a desaturated muted token for eyebrow / metadata text", () => {
    const html = renderSite(fixture, "academic");
    expect(rootBody(html)).toMatch(/--color-muted:\s*#6b5f4a/);
  });

  test("user theme tokens still override the academic baseline", () => {
    const overridden = structuredClone(fixture) as Site;
    overridden.theme = {
      id: "academic",
      tokens: { colorPrimary: "#000000", colorAccent: "#ffffff" },
    };
    const html = renderSite(overridden, "academic");
    const body = rootBody(html);
    const academicIdx = body.indexOf("#1a2440");
    const overrideIdx = body.lastIndexOf("#000000");
    expect(academicIdx).toBeGreaterThanOrEqual(0);
    expect(overrideIdx).toBeGreaterThan(academicIdx);
  });
});

describe("academic theme — typography tokens on :root", () => {
  test("declares a serif headline stack", () => {
    const html = renderSite(fixture, "academic");
    const body = rootBody(html);
    const allHeadline = [...body.matchAll(/--font-headline:\s*([^;]+);/g)].map((m) => m[1] ?? "");
    const last = allHeadline[allHeadline.length - 1] ?? "";
    expect(last).toMatch(/serif/);
    expect(last).toMatch(/Iowan Old Style|Charter|Georgia/);
  });

  test("declares a serif body stack (academic palette is serif throughout)", () => {
    const html = renderSite(fixture, "academic");
    const body = rootBody(html);
    const allBody = [...body.matchAll(/--font-body:\s*([^;]+);/g)].map((m) => m[1] ?? "");
    expect(allBody.length).toBeGreaterThan(0);
    expect(allBody[allBody.length - 1] ?? "").toMatch(/serif/);
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
    // The CSS body rule references a `--leading-body` token. Resolve it from
    // the :root rule and assert the numeric value is generous.
    const root = rootBody(html);
    const leading = /--leading-body:\s*([0-9]*\.?[0-9]+)/.exec(root);
    expect(leading).not.toBeNull();
    expect(parseFloat(leading![1] ?? "0")).toBeGreaterThanOrEqual(1.6);
    // And the body rule must actually consume that token.
    const css = nonRootCss(html);
    expect(css).toMatch(/\bbody\s*\{[\s\S]*?line-height:\s*var\(--leading-body\)/);
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
