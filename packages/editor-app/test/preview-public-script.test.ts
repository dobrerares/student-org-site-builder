/**
 * The interactive-preview seam (ADR 0046, ADR 0054).
 *
 * The editor preview is static: a Theme package's `public.js` is never
 * emitted unless the caller asks. `PreviewOptions.includePublicScript` is the
 * whole switch the interactive-preview toggle (issue #110) will flip, so it
 * is pinned here even though nothing in the UI sets it yet.
 */

import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import type { ThemeBundle } from "@sosb/renderer";

import minimal from "./fixtures/minimal-site.json" with { type: "json" };
import { iframeSrcdoc } from "../src/iframe-srcdoc.js";

const THEME_ID = "org.example.previewscript";

const bundle: ThemeBundle = {
  id: THEME_ID,
  name: "Preview script",
  version: "1.0.0",
  origin: "package",
  css: "",
  baselineTokens: [],
  supports: { colors: true, fonts: true, density: true, radius: true },
  blockVariants: {},
  shellVariants: [],
  fontSource: { kind: "registry" },
  assets: new Map(),
  publicScript: { file: "public.js", bytes: new Uint8Array([1]), network: [], offline: undefined },
};

const site: Site = { ...(minimal as unknown as Site), theme: { id: THEME_ID } };
const resolver = (path: string): string => `blob:sosb/${path}`;

describe("iframeSrcdoc and the Theme's public script", () => {
  test("is static by default: no script tag, whatever the Theme ships", () => {
    const html = iframeSrcdoc(site, THEME_ID, 0, resolver, bundle);
    expect(html).not.toContain("data-sosb-theme-script");
    // Still a preview document in every other respect.
    expect(html).toContain("data-sosb-preview-morph");
  });

  test("includes the script only when the preview option asks, through the blob resolver", () => {
    const html = iframeSrcdoc(site, THEME_ID, 0, resolver, bundle, { includePublicScript: true });
    expect(html).toContain(
      `<script defer src="blob:sosb/assets/theme/${THEME_ID}/public.js" data-sosb-theme-script></script>`,
    );
  });

  test("the flag is the only difference between the two documents", () => {
    const off = iframeSrcdoc(site, THEME_ID, 0, resolver, bundle);
    const on = iframeSrcdoc(site, THEME_ID, 0, resolver, bundle, { includePublicScript: true });
    const tag = `<script defer src="blob:sosb/assets/theme/${THEME_ID}/public.js" data-sosb-theme-script></script>`;
    expect(on.replace(tag, "")).toBe(off);
  });
});
