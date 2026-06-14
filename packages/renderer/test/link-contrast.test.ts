import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import heroOnly from "./fixtures/hero-only.json" with { type: "json" };
import { renderSite } from "../src/index.js";
import { contrastRatio } from "../src/color-math.js";
import { PRODUCTION_SITE_BASE_CSS } from "../src/themes/production-base.js";

const fixture = heroOnly as unknown as Site;

const PRODUCTION_THEME_IDS = ["minimal", "modern", "editorial", "civic", "academic"] as const;

/** Themes whose accent clears AA on their bg → --color-link resolves to accent. */
const ACCENT_LINK_THEMES = new Set(["minimal", "modern", "civic"]);
/** Themes whose accent fails AA on their bg → --color-link falls back to primary. */
const PRIMARY_LINK_THEMES = new Set(["editorial", "academic"]);

/** Last declaration of a `--token: value;` in the composed HTML, comments stripped. */
function lastDeclaration(html: string, prop: string): string {
  const css = html.replace(/\/\*[\s\S]*?\*\//g, "");
  const re = new RegExp(`${prop}:\\s*([^;]+);`, "g");
  let match: RegExpExecArray | null;
  let last = "";
  while ((match = re.exec(css)) !== null) last = match[1]!.trim();
  return last;
}

/**
 * Resolve `--color-link` to its actual hex by following which palette var it
 * references in the same `:root`. `--color-link` is always `var(--color-accent)`
 * or `var(--color-primary)` (a ref, never a raw hex), so we read that var's
 * resolved hex from the same document.
 */
function resolveLinkHex(html: string): { ref: string; hex: string } {
  const link = lastDeclaration(html, "--color-link");
  const m = /^var\((--color-[a-z]+)\)$/.exec(link);
  expect(m, `--color-link should be a var() ref, got "${link}"`).not.toBeNull();
  const ref = m![1]!;
  const hex = lastDeclaration(html, ref);
  return { ref, hex };
}

describe("--color-link: contrast-safe body-link text in every production theme", () => {
  for (const id of PRODUCTION_THEME_IDS) {
    test(`${id}: resolved link color meets WCAG AA (>=4.5:1) against bg`, () => {
      const site = structuredClone(fixture) as Site;
      site.theme = { id, tokens: {} };
      const html = renderSite(site, id);

      const { hex: linkHex } = resolveLinkHex(html);
      const bg = lastDeclaration(html, "--color-bg");
      expect(linkHex).toMatch(/^#[0-9a-fA-F]{3,6}$/);
      expect(bg).toMatch(/^#[0-9a-fA-F]{3,6}$/);

      const ratio = contrastRatio(linkHex, bg);
      expect(ratio).toBeDefined();
      expect(ratio!).toBeGreaterThanOrEqual(4.5);
    });

    test(`${id}: --color-link resolves to the expected palette role`, () => {
      const site = structuredClone(fixture) as Site;
      site.theme = { id, tokens: {} };
      const html = renderSite(site, id);
      const { ref } = resolveLinkHex(html);

      if (ACCENT_LINK_THEMES.has(id)) {
        expect(ref).toBe("--color-accent");
      } else if (PRIMARY_LINK_THEMES.has(id)) {
        expect(ref).toBe("--color-primary");
      } else {
        throw new Error(`unclassified theme ${id}`);
      }
    });
  }

  test("academic + editorial fall back to PRIMARY (accent too light on cream)", () => {
    for (const id of ["academic", "editorial"]) {
      const site = structuredClone(fixture) as Site;
      site.theme = { id, tokens: {} };
      const html = renderSite(site, id);
      expect(resolveLinkHex(html).ref).toBe("--color-primary");
    }
  });

  test("civic + modern + minimal keep the ACCENT (it clears AA on their bg)", () => {
    for (const id of ["civic", "modern", "minimal"]) {
      const site = structuredClone(fixture) as Site;
      site.theme = { id, tokens: {} };
      const html = renderSite(site, id);
      expect(resolveLinkHex(html).ref).toBe("--color-accent");
    }
  });
});

describe("--color-link: override-proof against a pale user accent", () => {
  test("overriding colorAccent to a pale color falls back to primary", () => {
    const site = structuredClone(fixture) as Site;
    // Modern normally keeps the accent (blue clears AA); a pale override must
    // flip --color-link to primary so link text stays AA.
    site.theme = { id: "modern", tokens: { colorAccent: "#eeeeee" } };
    const html = renderSite(site, "modern");

    expect(lastDeclaration(html, "--color-accent")).toBe("#eeeeee");
    const { ref, hex } = resolveLinkHex(html);
    expect(ref).toBe("--color-primary");

    const bg = lastDeclaration(html, "--color-bg");
    expect(contrastRatio(hex, bg)!).toBeGreaterThanOrEqual(4.5);
  });

  test("a legible user accent override keeps links on the accent", () => {
    const site = structuredClone(fixture) as Site;
    // Override academic's failing gold with a dark teal that clears AA on cream.
    site.theme = { id: "academic", tokens: { colorAccent: "#0a5c5c" } };
    const html = renderSite(site, "academic");

    expect(lastDeclaration(html, "--color-accent")).toBe("#0a5c5c");
    const { ref, hex } = resolveLinkHex(html);
    expect(ref).toBe("--color-accent");

    const bg = lastDeclaration(html, "--color-bg");
    expect(contrastRatio(hex, bg)!).toBeGreaterThanOrEqual(4.5);
  });
});

describe("--color-link hygiene + universal link rule", () => {
  test("--color-link is a var() ref (no raw hex), so it lives only in :root", () => {
    const html = renderSite(fixture, "academic");
    expect(lastDeclaration(html, "--color-link")).toMatch(/^var\(--color-(accent|primary)\)$/);
  });

  test("production base ships the universal contrast-safe link rule", () => {
    expect(PRODUCTION_SITE_BASE_CSS).toMatch(
      /\[data-block\]\s*a\s*\{[^}]*color:\s*var\(--color-link\)/,
    );
    // Underline carries the accent (identity) while text color stays AA.
    expect(PRODUCTION_SITE_BASE_CSS).toMatch(/text-decoration-color:\s*var\(--color-accent\)/);
    // Hover thickens the underline; it must NOT swap text to the accent.
    expect(PRODUCTION_SITE_BASE_CSS).toMatch(
      /\[data-block\]\s*a:hover\s*\{[^}]*text-decoration-thickness:\s*2px/,
    );
  });
});
