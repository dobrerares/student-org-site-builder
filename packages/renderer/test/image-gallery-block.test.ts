import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import gridFixture from "./fixtures/image-gallery-only.json" with { type: "json" };
import { renderSite } from "../src/index.js";

const fixture = gridFixture as unknown as Site;

/**
 * imageGallery renderer (issue #14).
 *
 * The renderer ships:
 *  - a semantic `<section data-block="imageGallery">` wrapper labelled by
 *    the gallery's title (when present);
 *  - per-image `<figure>` + `<img>` (alt) + optional `<figcaption>`;
 *  - a layout-driving `data-layout="grid|masonry"` attribute and a
 *    `style="--gallery-columns: N"` for theme CSS to consume;
 *  - when `lightbox: true`, a hidden lightbox dialog scaffold and the
 *    vanilla-JS bootstrap inline; when `false`, neither.
 *
 * The lightbox JS is shipped inline inside the rendered page so the built
 * site matches the renderer (no separate runtime). See ADR 0006.
 */
describe("renderSite — imageGallery block (structural)", () => {
  test("renders a section with the imageGallery role", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/<section[^>]*data-block="imageGallery"/);
  });

  test("tolerates an image with no asset yet (editor mid-add) — skips it, no crash", () => {
    // The editor's "Add image" creates an asset-less image before the upload
    // completes (asset is mandatory in the schema but cannot be fabricated per
    // ADR 0044). The renderer drives the live preview, so it must not crash
    // dereferencing `image.asset.path` — it skips the image until an asset
    // exists.
    const site = structuredClone(fixture) as unknown as Site;
    const block = site.pages[0]!.blocks.find((b) => b.type === "imageGallery")!;
    (block.data as { images: unknown[] }).images.push({ alt: "Being added" });
    let html = "";
    expect(() => {
      html = renderSite(site, "stub");
    }).not.toThrow();
    expect(html).toMatch(/<section[^>]*data-block="imageGallery"/);
    // The asset-less image is skipped, so its alt never reaches the output.
    expect(html).not.toContain("Being added");
  });

  test("renders the gallery title and uses it for aria-labelledby", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toContain("Galerie evenimente");
    expect(html).toMatch(/aria-labelledby="blk_gallery_home__title"/);
    expect(html).toMatch(/id="blk_gallery_home__title"/);
  });

  test("emits the layout and column count via data attributes / CSS variables", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/data-layout="grid"/);
    // Column count is exposed as a CSS custom property the theme CSS uses
    // for the `grid-template-columns: repeat(var(--gallery-columns), ...)` rule.
    expect(html).toMatch(/--gallery-columns:\s*3/);
  });

  test("renders one <figure> per image with alt text on the <img>", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(
      /<figure[^>]*>[\s\S]*?<img[^>]*alt="Studenți la o conferință de toamnă"[\s\S]*?<\/figure>/,
    );
    expect(html).toMatch(
      /<figure[^>]*>[\s\S]*?<img[^>]*alt="Diacritic test: ăîâșț"[\s\S]*?<\/figure>/,
    );
  });

  test("renders captions inside <figcaption> when supplied", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toContain("<figcaption");
    expect(html).toContain("Conferința de toamnă");
  });

  test("references the asset's path (not the hash) on each <img>", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toContain('src="assets/8e3a7f9b1c0d2e4f.jpg"');
    expect(html).toContain('src="assets/4b2c1d8a3e5f6071.png"');
  });

  test("emits width/height attributes for layout-stable image rendering", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/<img[^>]*width="1600"/);
    expect(html).toMatch(/<img[^>]*height="1067"/);
  });

  test("uses lazy loading for gallery images (PRD performance budget)", () => {
    const html = renderSite(fixture, "stub");
    // every gallery image carries loading="lazy"
    const imgs = [...html.matchAll(/<img[^>]*src="assets\/[^"]+"[^>]*>/g)].map((m) => m[0]);
    expect(imgs.length).toBeGreaterThan(0);
    for (const img of imgs) {
      expect(img).toMatch(/loading="lazy"/);
    }
  });
});

describe("renderSite — imageGallery block (lightbox on/off)", () => {
  test("emits a lightbox dialog scaffold when lightbox is enabled", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/role="dialog"/);
    expect(html).toMatch(/aria-modal="true"/);
    expect(html).toMatch(/data-block-id="blk_gallery_home"/);
    // The dialog itself is marked with `data-sosb-lightbox`.
    expect(html).toMatch(/<div[^>]*data-sosb-lightbox(?!-)/);
  });

  test("ships the vanilla-JS lightbox bootstrap inline when lightbox is enabled", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/<script[^>]*data-sosb-lightbox-script/);
    // No external src — the JS is inline and self-contained.
    expect(html).not.toMatch(/<script[^>]*data-sosb-lightbox-script[^>]*src=/);
  });

  test("each <figure> exposes an interactive trigger (button) when lightbox is on", () => {
    const html = renderSite(fixture, "stub");
    // The trigger is a real button so keyboard activation works without JS.
    expect(html).toMatch(/<button[^>]*data-sosb-lightbox-open/);
  });

  test("does NOT emit the lightbox dialog or script when lightbox is disabled", () => {
    const off = structuredClone(fixture) as Site;
    const block = off.pages[0]!.blocks[0]! as { data: Record<string, unknown> };
    block.data.lightbox = false;
    const html = renderSite(off, "stub");
    // The dialog and the inline script must not be present. The stub theme
    // ships CSS rules under the `data-sosb-lightbox` selector regardless,
    // so we look outside the `<style>` block.
    const styleStripped = html.replace(/<style[^>]*>[\s\S]*?<\/style>/g, "");
    expect(styleStripped).not.toMatch(/data-sosb-lightbox(-script)?\b/);
    expect(styleStripped).not.toMatch(/aria-modal="true"/);
    expect(styleStripped).not.toMatch(/role="dialog"/);
  });
});

describe("renderSite — imageGallery layouts", () => {
  test("production gallery triggers crop images to fill the thumbnail frame", () => {
    const html = renderSite(fixture, "academic");
    expect(html).toMatch(
      /\[data-block="imageGallery"\] \.image-gallery__trigger img,[\s\S]*aspect-ratio:\s*16 \/ 9/,
    );
    expect(html).toMatch(
      /\[data-block="imageGallery"\] \.image-gallery__trigger img,[\s\S]*height:\s*auto/,
    );
  });

  test("renders a masonry layout with the matching data-layout attribute", () => {
    const masonry = structuredClone(fixture) as Site;
    const block = masonry.pages[0]!.blocks[0]! as { data: Record<string, unknown> };
    block.data.layout = "masonry";
    block.data.columns = 2;
    const html = renderSite(masonry, "stub");
    expect(html).toMatch(/data-layout="masonry"/);
    expect(html).toMatch(/--gallery-columns:\s*2/);
  });
});

describe("renderSite — imageGallery JS budget (#14 AC: lightbox JS under 3kb)", () => {
  test("the inline lightbox script is under 3072 bytes minified", () => {
    const html = renderSite(fixture, "stub");
    const match = /<script[^>]*data-sosb-lightbox-script[^>]*>([\s\S]*?)<\/script>/.exec(html);
    if (match === null) throw new Error("expected an inline lightbox script");
    const inline = match[1] ?? "";
    // The renderer ships the minified script so the on-disk size matches the
    // shipped size — no tooling outside of esbuild's built-in minifier.
    const sizeBytes = new TextEncoder().encode(inline).length;
    expect(sizeBytes).toBeLessThan(3072);
  });

  test("the inline lightbox script is included exactly once even if multiple galleries exist", () => {
    const dual = structuredClone(fixture) as Site;
    // Add a second gallery on the same page.
    const second = structuredClone(dual.pages[0]!.blocks[0]!);
    (second as { id: string }).id = "blk_gallery_two";
    dual.pages[0]!.blocks.push(second);
    const html = renderSite(dual, "stub");
    const matches = html.match(/<script[^>]*data-sosb-lightbox-script/g) ?? [];
    expect(matches.length).toBe(1);
  });
});

describe("renderSite — imageGallery determinism", () => {
  test("repeated calls with the same input produce byte-identical output", () => {
    const a = renderSite(fixture, "stub");
    const b = renderSite(fixture, "stub");
    expect(a).toBe(b);
  });
});

describe("renderSite — imageGallery preserves forward-compat fields", () => {
  test("unknown fields on data and individual images survive rendering", () => {
    const withExtra = structuredClone(fixture) as Site;
    const block = withExtra.pages[0]!.blocks[0]! as { data: Record<string, unknown> };
    block.data.spacing = "tight";
    const images = block.data.images as { focusPoint?: unknown }[];
    images[0]!.focusPoint = { x: 0.5, y: 0.5 };
    // Should not throw — the renderer must tolerate extra fields.
    const html = renderSite(withExtra, "stub");
    expect(html).toContain("Galerie evenimente");
  });
});
