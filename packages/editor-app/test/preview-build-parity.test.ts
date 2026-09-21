/**
 * What the editor previews must be what the exporter ships.
 *
 * ADR 0005 made the preview iframe and the built site byte-identical by
 * sharing the renderer, and `iframe-renderer-reuse.test.ts` asserts that the
 * editor calls the same symbol. That is necessary but not sufficient: the two
 * call sites pass different options (`mode`, `assetUrlForPath`), and the build
 * pipeline layers an SEO overlay on top of the renderer's output. Every one of
 * those is a place the two can drift without a single import changing.
 *
 * This suite closes that gap for the real thing: the HISTORIPOL sample site,
 * every page, under every theme the renderer registers. It renders each page
 * the way the editor previews it and the way `build()` emits it, normalises
 * away the differences that are *allowed*, and requires the rest to be
 * identical.
 *
 * The allowed differences are enumerated explicitly below rather than being
 * absorbed by a loose comparison, because the whole value of this test is that
 * a NEW divergence — one nobody wrote down — fails CI. Adding a case to
 * `NORMALISERS` is a deliberate act that shows up in review.
 */
import { describe, expect, test } from "vitest";
import { build } from "@sosb/build";
import { KNOWN_THEME_IDS, pageDistPath } from "@sosb/renderer";
import type { Site } from "@sosb/schema";

import historipol from "./fixtures/historipol.json" with { type: "json" };
import { renderPreviewHtml } from "../src/preview-html.js";

const site = historipol as unknown as Site;

/**
 * The editor's preview resolves asset paths to in-memory `blob:` URLs. Tests
 * cannot mint real ones in node, and their values are random anyway, so the
 * preview render uses a deterministic stand-in with the same shape that the
 * normaliser can invert. If a code path ever leaks an unresolved path into the
 * preview while the build emits a resolved one (or vice versa), the inversion
 * will not line up and the comparison fails — which is the point.
 */
const BLOB_PREFIX = "blob:sosb-test/";
function previewAssetUrl(path: string): string | undefined {
  return `${BLOB_PREFIX}${path}`;
}

interface Normaliser {
  readonly why: string;
  readonly apply: (html: string) => string;
}

const NORMALISERS: readonly Normaliser[] = [
  {
    why: "preview-only link interceptor — never emitted into a built site",
    apply: (html) => html.replace(/<script data-sosb-preview-nav[^>]*>[\s\S]*?<\/script>/g, ""),
  },
  {
    why: "preview-only in-place update receiver — never emitted into a built site",
    apply: (html) => html.replace(/<script data-sosb-preview-morph[^>]*>[\s\S]*?<\/script>/g, ""),
  },
  {
    why: "build-only SEO overlay: JSON-LD blobs injected by @sosb/build",
    apply: (html) => html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, ""),
  },
  {
    why: "asset URLs: the preview resolves to blob: object URLs, the build emits VFS paths",
    apply: (html) => html.split(BLOB_PREFIX).join(""),
  },
  {
    why:
      "page-depth hops: a built nested page reaches assets through `../`, " +
      "while the preview is a single srcdoc document with no directory depth " +
      "and resolves every asset to an absolute blob: URL instead",
    apply: (html) => html.replace(/(?:\.\.\/)+assets\//g, "assets/"),
  },
];

function normalise(html: string): string {
  let out = html;
  for (const n of NORMALISERS) out = n.apply(out);
  return out;
}

function previewOf(themeId: string, pageIndex: number): string {
  return renderPreviewHtml(site, themeId, {
    mode: "preview",
    pageIndex,
    assetUrlForPath: previewAssetUrl,
  });
}

function buildOf(themeId: string, pageIndex: number): string {
  // No `siteUrl`: the canonical / og:url / og:image overlay is opt-in, and
  // leaving it off keeps the set of allowed differences as small as possible.
  const dist = build(site, { themeId, skipValidation: true });
  const page = site.pages[pageIndex]!;
  const html = dist.get(pageDistPath(site, page));
  if (typeof html !== "string") {
    throw new Error(`build() emitted no HTML for ${pageDistPath(site, page)}`);
  }
  return html;
}

describe("preview / build parity — HISTORIPOL across every registered theme", () => {
  for (const themeId of KNOWN_THEME_IDS) {
    describe(themeId, () => {
      site.pages.forEach((page, pageIndex) => {
        test(`${pageDistPath(site, page)} renders identically`, () => {
          expect(normalise(previewOf(themeId, pageIndex))).toBe(
            normalise(buildOf(themeId, pageIndex)),
          );
        });
      });
    });
  }
});

describe("the normalisers are all load-bearing", () => {
  // A normaliser that no longer matches anything is a normaliser that is
  // hiding nothing — and the next person to read this file would reasonably
  // assume it still describes a real divergence. Fail instead, so a removed
  // divergence gets its normaliser removed too.
  // Checked across the whole matrix: the page-depth normaliser, for instance,
  // only has anything to do on a nested page.
  const samples = site.pages.flatMap((_page, pageIndex) => [
    previewOf("academic", pageIndex),
    buildOf("academic", pageIndex),
  ]);

  for (const n of NORMALISERS) {
    test(`still applies: ${n.why}`, () => {
      expect(samples.some((html) => n.apply(html) !== html)).toBe(true);
    });
  }
});

describe("no preview-only artefact reaches the build output", () => {
  for (const themeId of KNOWN_THEME_IDS) {
    test(`${themeId}: build output carries no blob: URL`, () => {
      // A `blob:` URL in a built site is a dead link the moment the editor
      // tab closes. The preview resolver must never reach the build path.
      for (const [path, value] of build(site, { themeId, skipValidation: true })) {
        if (typeof value !== "string") continue;
        expect(value, `${path} contains a blob: URL`).not.toContain("blob:");
      }
    });

    test(`${themeId}: build output carries no preview-only script`, () => {
      for (const [path, value] of build(site, { themeId, skipValidation: true })) {
        if (typeof value !== "string") continue;
        expect(value, `${path} carries the preview nav script`).not.toContain(
          "data-sosb-preview-nav",
        );
        expect(value, `${path} carries the preview morph script`).not.toContain(
          "data-sosb-preview-morph",
        );
      }
    });
  }
});
