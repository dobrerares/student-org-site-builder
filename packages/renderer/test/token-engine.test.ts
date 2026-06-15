import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import heroOnly from "./fixtures/hero-only.json" with { type: "json" };
import { emitTokenRoot, densityScale, radiusBase, resolveFontFamilies } from "../src/tokens.js";
import { PRODUCTION_SITE_BASE_CSS } from "../src/themes/production-base.js";
import { renderSite } from "../src/index.js";
import { onColorFor } from "../src/color-math.js";

const fixture = heroOnly as unknown as Site;

function rootOf(site: Site): string {
  return emitTokenRoot(site);
}

describe("densityScale / radiusBase mappers", () => {
  test("named density maps to a numeric multiplier", () => {
    expect(densityScale("compact")).toBe("0.85");
    expect(densityScale("normal")).toBe("1");
    expect(densityScale("comfortable")).toBe("1.15");
    expect(densityScale(undefined)).toBe("1");
    expect(densityScale("nonsense")).toBe("1");
  });

  test("named radius maps to a base length", () => {
    expect(radiusBase("sharp")).toBe("0px");
    expect(radiusBase("soft")).toBe("6px");
    expect(radiusBase("round")).toBe("14px");
    expect(radiusBase(undefined)).toBe("6px");
  });
});

describe("baseline engine tokens", () => {
  test("spacing scale is density-scaled via calc + var(--density-scale)", () => {
    const root = rootOf(fixture);
    expect(root).toContain("--density-scale: 1;");
    expect(root).toContain("--space-md: calc(1rem * var(--density-scale));");
    expect(root).toContain("--space-xl: calc(4rem * var(--density-scale));");
  });

  test("radius scale derives from a single --radius-base", () => {
    const root = rootOf(fixture);
    expect(root).toContain("--radius-base: 8px;");
    expect(root).toContain("--radius-md: var(--radius-base);");
    expect(root).toContain("--radius-sm: calc(var(--radius-base) * 0.5);");
  });

  test("type scale is fluid (clamp) for every step", () => {
    const root = rootOf(fixture);
    for (const step of ["xs", "sm", "base", "lg", "xl", "2xl", "3xl"]) {
      expect(root).toMatch(new RegExp(`--type-${step}:\\s*clamp\\(`));
    }
  });

  test("emits readable measure caps and a fluid section gap", () => {
    const root = rootOf(fixture);
    expect(root).toContain("--measure-body: 66ch;");
    expect(root).toContain("--measure-title: 28ch;");
    expect(root).toMatch(/--section-gap:\s*calc\(clamp\(/);
  });
});

describe("density + radius overrides are wired (no longer dead)", () => {
  test("user density override emits a numeric --density-scale", () => {
    const site = structuredClone(fixture) as Site;
    site.theme = { id: "stub", tokens: { density: "compact" } };
    expect(emitTokenRoot(site)).toContain("--density-scale: 0.85;");
  });

  test("user radius override emits a --radius-base length", () => {
    const site = structuredClone(fixture) as Site;
    site.theme = { id: "stub", tokens: { radius: "round" } };
    expect(emitTokenRoot(site)).toContain("--radius-base: 14px;");
  });
});

describe("resolution-dependent derived tokens", () => {
  test("emits rgb siblings for the resolved palette (for scrims)", () => {
    const root = rootOf(fixture);
    expect(root).toContain("--color-primary-rgb: 31, 58, 95;");
    expect(root).toContain("--color-bg-rgb: 255, 255, 255;");
    expect(root).toContain("--color-fg-rgb: 26, 26, 26;");
  });

  test("emits contrast-safe on-colors for the resolved accent/primary", () => {
    const root = rootOf(fixture);
    expect(root).toContain("--color-on-accent: #16181c;");
    expect(root).toContain("--color-on-primary: #ffffff;");
  });

  test("on-color follows a user accent override (white accent -> dark ink)", () => {
    const site = structuredClone(fixture) as Site;
    site.theme = { id: "stub", tokens: { colorAccent: "#ffffff" } };
    const root = emitTokenRoot(site);
    expect(root).toContain("--color-accent: #ffffff;");
    expect(root).toContain("--color-on-accent: #16181c;");
  });

  test("derived rgb + on-color follow a themeBaseline raw-pair color override", () => {
    const site = structuredClone(fixture) as Site;
    site.theme = { id: "stub", tokens: {} };
    const root = emitTokenRoot(site, undefined, [["--color-accent", "#ffffff"]]);
    expect(root).toContain("--color-accent: #ffffff;");
    expect(root).toContain("--color-accent-rgb: 255, 255, 255;");
    expect(root).toContain("--color-on-accent: #16181c;");
  });

  test("user token beats themeDefaults and derived on-color follows the user value", () => {
    const site = structuredClone(fixture) as Site;
    site.theme = { id: "stub", tokens: { colorAccent: "#ffffff" } };
    const root = emitTokenRoot(site, { colorAccent: "#cb2b2b" });
    const themeAccent = root.indexOf("--color-accent: #cb2b2b;");
    const userAccent = root.lastIndexOf("--color-accent: #ffffff;");
    expect(themeAccent).toBeGreaterThanOrEqual(0);
    expect(userAccent).toBeGreaterThan(themeAccent);
    expect(root).toContain("--color-on-accent: #16181c;");
  });
});

describe("resolveFontFamilies — primary family under the cascade", () => {
  test("falls back to the baseline stacks' primary families", () => {
    const site = structuredClone(fixture) as Site;
    site.theme = { id: "stub", tokens: {} };
    // Baseline: --font-headline "Georgia, serif", --font-body "system-ui, sans-serif".
    expect(resolveFontFamilies(site)).toEqual({ headline: "Georgia", body: "system-ui" });
  });

  test("extracts the leading quoted family from a stack", () => {
    const site = structuredClone(fixture) as Site;
    site.theme = { id: "stub", tokens: { fontHeadline: '"Space Grotesk", system-ui, sans-serif' } };
    expect(resolveFontFamilies(site).headline).toBe("Space Grotesk");
  });

  test("user override beats themeDefaults beats themeBaseline (last wins)", () => {
    const site = structuredClone(fixture) as Site;
    site.theme = { id: "stub", tokens: { fontBody: '"Inter", sans-serif' } };
    const got = resolveFontFamilies(site, { fontBody: '"Source Serif 4", serif' }, [
      ["--font-body", '"Fraunces", serif'],
    ]);
    expect(got.body).toBe("Inter");
  });

  test("themeBaseline raw pair wins over themeDefaults when no user override", () => {
    const site = structuredClone(fixture) as Site;
    site.theme = { id: "stub", tokens: {} };
    const got = resolveFontFamilies(site, { fontHeadline: '"Archivo", sans-serif' }, [
      ["--font-headline", '"Fraunces", serif'],
    ]);
    expect(got.headline).toBe("Fraunces");
  });
});

describe("production base — overflow & aspect guards", () => {
  test("titles and prose wrap long words (no horizontal scroll)", () => {
    expect(PRODUCTION_SITE_BASE_CSS).toMatch(/overflow-wrap:\s*anywhere/);
    expect(PRODUCTION_SITE_BASE_CSS).toContain(".hero__title");
    expect(PRODUCTION_SITE_BASE_CSS).toContain(".hero__subtitle");
    expect(PRODUCTION_SITE_BASE_CSS).toContain(".contact-card__heading");
    expect(PRODUCTION_SITE_BASE_CSS).toMatch(/hyphens:\s*auto/);
  });

  test("content images are aspect-normalized with object-fit cover", () => {
    expect(PRODUCTION_SITE_BASE_CSS).toMatch(/aspect-ratio:\s*16 \/ 9/);
    expect(PRODUCTION_SITE_BASE_CSS).toMatch(/object-fit:\s*cover/);
    expect(PRODUCTION_SITE_BASE_CSS).toContain(".hero__media img");
  });
});

describe("density/radius reach rendered CSS through renderSite (regression)", () => {
  test("a density override changes the emitted --density-scale that --space-* consume", () => {
    const site = structuredClone(fixture) as Site;
    site.theme = { id: "minimal", tokens: { density: "comfortable" } };
    const html = renderSite(site, "minimal");
    expect(html).toContain("--density-scale: 1.15;");
    expect(html).toContain("--space-md: calc(1rem * var(--density-scale));");
  });

  test("a radius override changes the emitted --radius-base that --radius-* consume", () => {
    const site = structuredClone(fixture) as Site;
    site.theme = { id: "minimal", tokens: { radius: "sharp" } };
    const html = renderSite(site, "minimal");
    expect(html).toContain("--radius-base: 0px;");
    expect(html).toContain("--radius-md: var(--radius-base);");
  });
});

function lastDeclaration(html: string, prop: string): string {
  // Strip CSS comments first: theme CSS prose can legitimately mention token
  // names (e.g. editorial's `/* ... rather than --color-accent: ... */`), and
  // a naive scan would otherwise capture the comment body instead of the real
  // declaration that the cascade actually applies.
  const css = html.replace(/\/\*[\s\S]*?\*\//g, "");
  const re = new RegExp(`${prop}:\\s*([^;]+);`, "g");
  let match: RegExpExecArray | null;
  let last = "";
  while ((match = re.exec(css)) !== null) last = match[1]!.trim();
  return last;
}

describe("derived on-colors are correct for every production theme (contract)", () => {
  const PRODUCTION_THEME_IDS = ["minimal", "modern", "editorial", "civic", "academic"];
  for (const id of PRODUCTION_THEME_IDS) {
    test(`${id}: --color-on-accent matches onColorFor(resolved accent)`, () => {
      const site = structuredClone(fixture) as Site;
      site.theme = { id, tokens: {} };
      const html = renderSite(site, id);
      const accent = lastDeclaration(html, "--color-accent");
      expect(accent).toMatch(/^#[0-9a-fA-F]{3,6}$/);
      expect(lastDeclaration(html, "--color-on-accent")).toBe(onColorFor(accent));
    });
    test(`${id}: --color-on-primary matches onColorFor(resolved primary)`, () => {
      const site = structuredClone(fixture) as Site;
      site.theme = { id, tokens: {} };
      const html = renderSite(site, id);
      const primary = lastDeclaration(html, "--color-primary");
      expect(primary).toMatch(/^#[0-9a-fA-F]{3,6}$/);
      expect(lastDeclaration(html, "--color-on-primary")).toBe(onColorFor(primary));
    });
  }
});
