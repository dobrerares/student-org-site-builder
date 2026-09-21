/**
 * The renderer theme seam (ADR 0052).
 *
 * These tests build `ThemeBundle` values by hand rather than importing
 * `@sosb/theme-package`: the renderer must not depend on the package loader
 * (that would be a cycle), and the seam's contract is exactly "a bundle is
 * data" — so a hand-built one is a legitimate theme, not a mock.
 */

import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import heroOnly from "./fixtures/hero-only.json" with { type: "json" };
import {
  builtinThemeBundle,
  isBuiltinThemeId,
  offersBlockVariant,
  renderSite,
  resolveThemeBundle,
  rewriteThemeCssUrls,
  themeAssetsFor,
  themeReferenceIssue,
  type ThemeBundle,
} from "../src/index.js";

const fixture = heroOnly as unknown as Site;

const enc = new TextEncoder();

function customBundle(overrides: Partial<ThemeBundle> = {}): ThemeBundle {
  return {
    id: "org.example.test",
    name: "Test",
    version: "1.0.0",
    origin: "package",
    css: `[data-block="hero"]{background-image:url(assets/bg.svg);}`,
    baselineTokens: [["--color-primary", "#123456"]],
    supports: { colors: true, fonts: false, density: true, radius: true },
    blockVariants: {
      hero: [
        { id: "split", label: "Split" },
        { id: "spotlight", label: "Spotlight" },
      ],
    },
    shellVariants: [{ id: "compact", label: "Compact" }],
    fontSource: {
      kind: "bundle",
      faces: [
        { family: "Test Display", weight: 700, style: "normal", file: "fonts/display.woff2" },
      ],
      bytes: new Map([["fonts/display.woff2", enc.encode("woff2-bytes")]]),
    },
    assets: new Map([["assets/bg.svg", enc.encode("<svg/>")]]),
    ...overrides,
  };
}

function siteWith(theme: Site["theme"], mutate?: (site: Site) => void): Site {
  const site = structuredClone(fixture) as Site;
  site.theme = theme;
  mutate?.(site);
  return site;
}

describe("built-in themes as bundles", () => {
  test("every registered built-in id resolves to a bundle", () => {
    for (const id of ["stub", "minimal", "modern", "editorial", "civic", "academic"]) {
      expect(isBuiltinThemeId(id)).toBe(true);
      expect(builtinThemeBundle(id)?.origin).toBe("builtin");
    }
  });

  test("an unknown id is not built in and falls back to stub for rendering", () => {
    expect(isBuiltinThemeId("org.example.nope")).toBe(false);
    // Rendering still succeeds — content stays visible. The *export* is what
    // gets blocked, so an author never silently publishes the wrong design.
    expect(resolveThemeBundle("org.example.nope").id).toBe("stub");
  });

  test("passing a bundle whose id disagrees with themeId is a caller bug", () => {
    expect(() => resolveThemeBundle("modern", customBundle())).toThrow(/does not match/);
  });
});

describe("rendering under a package theme", () => {
  test("the theme's CSS and packaged @font-face reach the page", () => {
    const bundle = customBundle();
    const html = renderSite(siteWith({ id: bundle.id }), bundle.id, { theme: bundle });
    expect(html).toContain('font-family:"Test Display"');
    expect(html).toContain("assets/theme/org.example.test/fonts/display.woff2");
    expect(html).toContain("--color-primary: #123456");
  });

  test("relative url() targets are rewritten onto the canonical bundle path", () => {
    const bundle = customBundle();
    const html = renderSite(siteWith({ id: bundle.id }), bundle.id, { theme: bundle });
    expect(html).toContain('url("assets/theme/org.example.test/assets/bg.svg")');
    expect(html).not.toContain("url(assets/bg.svg)");
  });

  test("a preview resolver rewrites the same targets to blob URLs", () => {
    const bundle = customBundle();
    const html = renderSite(siteWith({ id: bundle.id }), bundle.id, {
      theme: bundle,
      assetUrlForPath: (path) => `blob:fake/${path}`,
    });
    expect(html).toContain('url("blob:fake/assets/theme/org.example.test/assets/bg.svg")');
    expect(html).toContain("blob:fake/assets/theme/org.example.test/fonts/display.woff2");
  });

  test("themeAssetsFor lists fonts and assets under one prefix", () => {
    expect([...themeAssetsFor(customBundle()).keys()]).toEqual([
      "assets/theme/org.example.test/assets/bg.svg",
      "assets/theme/org.example.test/fonts/display.woff2",
    ]);
  });

  test("renders are deterministic", () => {
    const bundle = customBundle();
    const site = siteWith({ id: bundle.id });
    expect(renderSite(site, bundle.id, { theme: bundle })).toBe(
      renderSite(site, bundle.id, { theme: bundle }),
    );
  });
});

describe("block design variants", () => {
  test("an offered variant is emitted as data-variant", () => {
    const bundle = customBundle();
    const site = siteWith({ id: bundle.id }, (s) => {
      s.pages[0]!.blocks[0]!.variant = "split";
    });
    expect(renderSite(site, bundle.id, { theme: bundle })).toContain('data-variant="split"');
  });

  test("a variant the theme does not offer is suspended, not emitted", () => {
    const bundle = customBundle();
    const site = siteWith({ id: bundle.id }, (s) => {
      s.pages[0]!.blocks[0]!.variant = "carousel";
    });
    const html = renderSite(site, bundle.id, { theme: bundle });
    expect(html).not.toContain("data-variant");
    // ...and the saved choice survives in the data, so switching back restores it.
    expect(site.pages[0]!.blocks[0]!.variant).toBe("carousel");
  });

  test("built-in themes offer no variants, so their markup is unchanged", () => {
    const site = siteWith({ id: "modern" }, (s) => {
      s.pages[0]!.blocks[0]!.variant = "split";
    });
    expect(renderSite(site, "modern")).not.toContain("data-variant");
    expect(offersBlockVariant(builtinThemeBundle("modern")!, "hero", "split")).toBe(false);
  });
});

describe("shell variants", () => {
  test("an offered shell variant lands on <body>", () => {
    const bundle = customBundle();
    const html = renderSite(siteWith({ id: bundle.id, shellVariant: "compact" }), bundle.id, {
      theme: bundle,
    });
    expect(html).toContain('<body data-shell-variant="compact">');
  });

  test("an unoffered shell variant is dropped", () => {
    const bundle = customBundle();
    const html = renderSite(siteWith({ id: bundle.id, shellVariant: "mega" }), bundle.id, {
      theme: bundle,
    });
    expect(html).toContain("<body>");
    expect(html).not.toContain("data-shell-variant");
  });
});

describe("themeReferenceIssue", () => {
  test("built-in themes always resolve", () => {
    expect(themeReferenceIssue(siteWith({ id: "civic" }))).toBeUndefined();
  });

  test("an installed package theme resolves", () => {
    expect(
      themeReferenceIssue(siteWith({ id: "org.example.test" }), ["org.example.test"]),
    ).toBeUndefined();
  });

  test("a missing package theme is reported by name", () => {
    const issue = themeReferenceIssue(siteWith({ id: "org.example.gone" }), []);
    expect(issue?.code).toBe("theme-missing");
    expect(issue?.themeId).toBe("org.example.gone");
    expect(issue?.message).toContain("org.example.gone");
  });
});

describe("rewriteThemeCssUrls", () => {
  test("leaves absolute and data URLs alone", () => {
    const css = `a{background:url(https://x.test/a.png)}b{background:url(data:image/svg+xml,%3Csvg/%3E)}c{background:url(/root.png)}`;
    expect(rewriteThemeCssUrls(css, "org.example.test")).toBe(css);
  });

  test("normalises a leading ./", () => {
    expect(rewriteThemeCssUrls("a{background:url(./assets/x.png)}", "t.t")).toContain(
      'url("assets/theme/t.t/assets/x.png")',
    );
  });
});
