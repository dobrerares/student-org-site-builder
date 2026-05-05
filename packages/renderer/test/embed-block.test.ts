// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import axe from "axe-core";
import type { Site } from "@sosb/schema";
import embedOnly from "./fixtures/embed-only.json" with { type: "json" };
import { renderSite, EMBED_LAZY_LOAD_SCRIPT } from "../src/index.js";

const fixture = embedOnly as unknown as Site;

/**
 * Embed block renderer tests (issue #20).
 *
 * AC mapping:
 *  - Each provider produces correct iframe attributes (allow, sandbox,
 *    referrer-policy, etc.) - see "iframe attribute hardening".
 *  - Privacy mode uses nocookie variants where the provider offers them -
 *    see "privacy mode / nocookie substitution".
 *  - Lazy load JS instantiates iframe only when in viewport - see "lazy
 *    placeholder" and the bundle-size guard below.
 *  - Lazy-load JS under 1kb minified - see "lazy-load JS bundle size".
 *  - Golden-file tests per provider x Academic theme - see golden-file.test.ts.
 */

function loadAsDocument(html: string): Document {
  // The vitest jsdom environment provides a real document. We rehydrate it
  // with the renderer's output so a11y / DOM queries see the actual tree.
  const langMatch = /<html[^>]*\blang="([^"]+)"/i.exec(html);
  const innerMatch = /<html[^>]*>([\s\S]*)<\/html>/i.exec(html);
  if (innerMatch === null) throw new Error("renderSite output missing <html> root");
  if (langMatch !== null && langMatch[1] !== undefined) {
    document.documentElement.setAttribute("lang", langMatch[1]);
  }
  document.documentElement.innerHTML = innerMatch[1] ?? "";
  return document;
}

describe("embed block renderer - privacy mode / nocookie substitution", () => {
  test("youtube uses youtube-nocookie.com when privacyMode=true", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
    expect(html).not.toMatch(/[^-]youtube\.com\/embed\//);
  });

  test("vimeo uses player.vimeo.com with dnt=1 when privacyMode=true", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/player\.vimeo\.com\/video\/76979871/);
    expect(html).toMatch(/dnt=1/);
  });

  test("twitter renders without third-party cookies (no widgets.twitter.com script)", () => {
    const html = renderSite(fixture, "stub");
    expect(html).not.toMatch(/widgets\.twitter\.com\/widgets\.js/);
    expect(html).toContain("https://twitter.com/jack/status/20");
  });

  test("instagram + facebook do not load Meta tracking scripts on the rendered page", () => {
    const html = renderSite(fixture, "stub");
    expect(html).not.toMatch(/connect\.facebook\.net/);
    expect(html).not.toMatch(/instagram\.com\/embed\.js/);
    expect(html).toContain("instagram.com/p/Cabc123XYZ_/");
    expect(html).toContain("facebook.com/somepage/posts/1234567890");
  });

  test("spotify uses open.spotify.com/embed/* for tracks", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/open\.spotify\.com\/embed\/track\/4cOdK2wGLETKBW3PvgPWqT/);
  });

  test("soundcloud uses w.soundcloud.com/player with the original URL", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/w\.soundcloud\.com\/player/);
    expect(html).toMatch(/url=https%3A%2F%2Fsoundcloud\.com%2Fforss%2Fflickermood/);
  });

  test("bandcamp uses bandcamp.com/EmbeddedPlayer/* (no nocookie variant exists)", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/bandcamp\.com\/EmbeddedPlayer/);
  });
});

describe("embed block renderer - iframe attribute hardening", () => {
  test('every iframe has loading="lazy"', () => {
    const html = renderSite(fixture, "stub");
    const doc = loadAsDocument(html);
    const iframes = [...doc.querySelectorAll("iframe")];
    for (const f of iframes) {
      expect(f.getAttribute("loading"), `iframe ${f.outerHTML}`).toBe("lazy");
    }
  });

  test("every iframe has a non-empty title attribute (axe / WCAG 2.4)", () => {
    const html = renderSite(fixture, "stub");
    const doc = loadAsDocument(html);
    const iframes = [...doc.querySelectorAll("iframe")];
    for (const f of iframes) {
      const title = f.getAttribute("title") ?? "";
      expect(title.length, `iframe ${f.outerHTML}`).toBeGreaterThan(0);
    }
  });

  test("every iframe declares a referrerpolicy and a sandbox", () => {
    const html = renderSite(fixture, "stub");
    const doc = loadAsDocument(html);
    const iframes = [...doc.querySelectorAll("iframe")];
    for (const f of iframes) {
      expect(f.getAttribute("referrerpolicy"), `iframe ${f.outerHTML}`).toBeTruthy();
      expect(f.getAttribute("sandbox"), `iframe ${f.outerHTML}`).toBeTruthy();
    }
  });

  test("every video iframe declares a conservative allow= list", () => {
    const html = renderSite(fixture, "stub");
    const doc = loadAsDocument(html);
    const iframes = [...doc.querySelectorAll("iframe")];
    const videoIframes = iframes.filter((f) => {
      const provider = f.getAttribute("data-embed-provider") ?? "";
      return ["youtube", "vimeo"].includes(provider);
    });
    for (const f of videoIframes) {
      const allow = f.getAttribute("allow") ?? "";
      expect(allow.length, `video iframe ${f.outerHTML}`).toBeGreaterThan(0);
      expect(allow).not.toMatch(/\bmicrophone\b/);
      expect(allow).not.toMatch(/\bcamera\b/);
    }
  });
});

describe("embed block renderer - lazy-load placeholder + JS", () => {
  test("emits a placeholder element with data-embed-* attributes for each lazy iframe embed", () => {
    const html = renderSite(fixture, "stub");
    const doc = loadAsDocument(html);
    const blocks = [...doc.querySelectorAll('[data-block="embed"]')];
    expect(blocks.length).toBe(8);
    // Iframe-backed providers carry data-embed-src so the lazy-loader can
    // hydrate them. Blockquote-backed providers (twitter/instagram/facebook)
    // do not, by design.
    const iframeProviders = ["youtube", "vimeo", "spotify", "soundcloud", "bandcamp"];
    for (const b of blocks) {
      const provider = b.getAttribute("data-embed-provider") ?? "";
      expect(provider).toBeTruthy();
      if (iframeProviders.includes(provider)) {
        expect(
          b.getAttribute("data-embed-src"),
          `${provider} should carry data-embed-src`,
        ).toBeTruthy();
        expect(
          b.getAttribute("data-embed-title"),
          `${provider} should carry data-embed-title`,
        ).toBeTruthy();
      }
    }
  });

  test("emits exactly one lazy-load <script> on a page with embed blocks", () => {
    const html = renderSite(fixture, "stub");
    const doc = loadAsDocument(html);
    const scripts = [...doc.querySelectorAll("script[data-sosb-embed-loader]")];
    expect(scripts.length).toBe(1);
  });

  test("does NOT emit the lazy-load script on pages that have no embeds", () => {
    const noEmbed = structuredClone(fixture) as Site;
    noEmbed.pages[0]!.blocks = [];
    const html = renderSite(noEmbed, "stub");
    expect(html).not.toContain("data-sosb-embed-loader");
  });

  test("the lazy-loader uses IntersectionObserver", () => {
    expect(EMBED_LAZY_LOAD_SCRIPT).toContain("IntersectionObserver");
  });

  test("the lazy-loader script is under 1kb when minified", () => {
    const bytes = new TextEncoder().encode(EMBED_LAZY_LOAD_SCRIPT).length;
    expect(bytes).toBeLessThan(1024);
  });
});

describe("embed block renderer - accessibility (axe-core)", () => {
  test("embed-only page has zero axe violations", async () => {
    const html = renderSite(fixture, "stub");
    const doc = loadAsDocument(html);
    const results = await axe.run(doc, {
      rules: {
        "color-contrast": { enabled: false },
      },
    });
    expect(results.violations).toEqual([]);
  });
});

describe("embed block renderer - non-lazy mode", () => {
  test("when lazyLoad=false, an <iframe> is rendered directly (not a placeholder)", () => {
    const eager = structuredClone(fixture) as Site;
    eager.pages[0]!.blocks = [eager.pages[0]!.blocks[0]!];
    (eager.pages[0]!.blocks[0]!.data as Record<string, unknown>).lazyLoad = false;
    const html = renderSite(eager, "stub");
    expect(html).toMatch(/<iframe[^>]+youtube-nocookie\.com/);
    expect(html).not.toContain("data-sosb-embed-loader");
  });

  test("when privacyMode=false on YouTube, falls back to youtube.com (still loading=lazy)", () => {
    const open = structuredClone(fixture) as Site;
    open.pages[0]!.blocks = [open.pages[0]!.blocks[0]!];
    (open.pages[0]!.blocks[0]!.data as Record<string, unknown>).lazyLoad = false;
    (open.pages[0]!.blocks[0]!.data as Record<string, unknown>).privacyMode = false;
    const html = renderSite(open, "stub");
    expect(html).toMatch(/youtube\.com\/embed\/dQw4w9WgXcQ/);
    expect(html).not.toMatch(/youtube-nocookie\.com/);
    expect(html).toMatch(/loading="lazy"/);
  });
});
