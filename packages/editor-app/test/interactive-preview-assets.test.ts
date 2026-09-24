/**
 * The interactive preview's asset delivery (ADR 0056).
 *
 * The interactive iframe has an opaque origin and therefore cannot load the
 * editor's `blob:` URLs, so every asset the static preview resolves to a blob
 * is resolved here to a `data:` URL carrying the same bytes under the same
 * canonical path. These tests pin the resolver, its caches and the two
 * sandbox attribute values the pane switches between.
 */
import { describe, expect, test } from "vitest";
import { MemoryDriver } from "@sosb/vfs";
import { FONT_ASSET_PREFIX, FONT_FACE_REGISTRY } from "@sosb/renderer";
import type { ThemeBundle } from "@sosb/renderer";

import {
  INTERACTIVE_PREVIEW_SANDBOX,
  STATIC_PREVIEW_SANDBOX,
  bytesToDataUrl,
  clearThemeDataUrls,
  getThemeDataUrls,
  interactiveAssetUrlForPath,
  prepareInteractiveAssetUrls,
} from "../src/interactive-preview.js";

const THEME_ID = "org.example.interactive";

function packageBundle(version = "1.0.0"): ThemeBundle {
  return {
    id: THEME_ID,
    name: "Interactive",
    version,
    origin: "package",
    css: "",
    baselineTokens: [],
    supports: { colors: true, fonts: true, density: true, radius: true },
    blockVariants: {},
    shellVariants: [],
    fontSource: {
      kind: "bundle",
      faces: [],
      bytes: new Map([["fonts/a.woff2", new Uint8Array([0x77, 0x4f, 0x46, 0x32])]]),
    },
    assets: new Map([["assets/grid.svg", new TextEncoder().encode("<svg/>")]]),
    publicScript: {
      file: "public.js",
      bytes: new TextEncoder().encode("document.title = 'ran';"),
      network: [],
      offline: undefined,
    },
  };
}

describe("bytesToDataUrl", () => {
  test("encodes bytes with their MIME type", () => {
    expect(bytesToDataUrl("text/plain", new TextEncoder().encode("hello"))).toBe(
      "data:text/plain;base64,aGVsbG8=",
    );
  });

  test("survives inputs larger than one call-stack's worth of arguments", () => {
    const big = new Uint8Array(300_000).fill(0x41);
    const url = bytesToDataUrl("application/octet-stream", big);
    expect(url.startsWith("data:application/octet-stream;base64,QUFB")).toBe(true);
    // 300,000 bytes → 400,000 base64 characters.
    expect(url.length).toBe("data:application/octet-stream;base64,".length + 400_000);
  });
});

describe("the sandbox attributes", () => {
  test("the static preview is unchanged from PR #116", () => {
    expect(STATIC_PREVIEW_SANDBOX).toBe("allow-scripts allow-same-origin allow-popups");
  });

  test("the interactive preview has an opaque origin and cannot navigate or submit", () => {
    const flags = INTERACTIVE_PREVIEW_SANDBOX.split(" ");
    expect(flags).not.toContain("allow-same-origin");
    expect(flags.some((f) => f.startsWith("allow-top-navigation"))).toBe(false);
    expect(flags).not.toContain("allow-forms");
    expect(flags).not.toContain("allow-modals");
    // The nav interceptor's `window.open` for external links still works.
    expect(flags).toContain("allow-scripts");
    expect(flags).toContain("allow-popups");
  });
});

describe("prepareInteractiveAssetUrls", () => {
  test("encodes every previewable upload, keyed by content hash", async () => {
    const vfs = new MemoryDriver();
    await vfs.write("assets/abc123.png", new Uint8Array([1, 2, 3]));
    await vfs.write("assets/doc456.pdf", new Uint8Array([4]));
    await vfs.write("assets/unknown.xyz", new Uint8Array([5]));
    await vfs.write("themes/x/theme.json", new Uint8Array([6]));

    const urls = await prepareInteractiveAssetUrls(vfs);
    expect(urls.get("abc123")).toBe("data:image/png;base64,AQID");
    expect(urls.get("doc456")).toBe("data:application/pdf;base64,BA==");
    expect(urls.has("unknown")).toBe(false);
    expect(urls.size).toBe(2);
  });
});

describe("interactiveAssetUrlForPath", () => {
  test("answers only canonical assets/ paths", () => {
    expect(interactiveAssetUrlForPath("https://example.org/x.png", packageBundle(), null)).toBe(
      undefined,
    );
    expect(interactiveAssetUrlForPath("about/", undefined, null)).toBe(undefined);
  });

  test("serves the renderer's registry fonts inline", () => {
    const first = Object.values(FONT_FACE_REGISTRY)[0]?.[0];
    if (first === undefined) throw new Error("the font registry is empty");
    const url = interactiveAssetUrlForPath(FONT_ASSET_PREFIX + first.file, undefined, null);
    expect(url?.startsWith("data:font/woff2;base64,")).toBe(true);
  });

  test("serves the Theme's fonts, decorative files and public script inline", () => {
    clearThemeDataUrls();
    const bundle = packageBundle();
    const prefix = `assets/theme/${THEME_ID}/`;
    expect(interactiveAssetUrlForPath(`${prefix}assets/grid.svg`, bundle, null)).toBe(
      "data:image/svg+xml;base64,PHN2Zy8+",
    );
    expect(interactiveAssetUrlForPath(`${prefix}fonts/a.woff2`, bundle, null)).toBe(
      "data:font/woff2;base64,d09GMg==",
    );
    // The script must be typed as JavaScript or the browser refuses to run it.
    expect(interactiveAssetUrlForPath(`${prefix}public.js`, bundle, null)).toBe(
      `data:text/javascript;base64,${btoa("document.title = 'ran';")}`,
    );
    // render.js never reaches the document (ADR 0054).
    expect(interactiveAssetUrlForPath(`${prefix}render.js`, bundle, null)).toBe(undefined);
  });

  test("serves uploads from the prepared map, by hash", () => {
    const uploads = new Map([["abc123", "data:image/png;base64,AQID"]]);
    expect(interactiveAssetUrlForPath("assets/abc123.png", undefined, uploads)).toBe(
      "data:image/png;base64,AQID",
    );
    expect(interactiveAssetUrlForPath("assets/missing.png", undefined, uploads)).toBe(undefined);
    expect(interactiveAssetUrlForPath("assets/abc123.png", undefined, null)).toBe(undefined);
  });

  test("a built-in Theme contributes no files", () => {
    const builtin: ThemeBundle = { ...packageBundle(), origin: "builtin" } as ThemeBundle;
    expect(getThemeDataUrls(builtin).size).toBe(0);
  });
});

describe("the Theme data: cache", () => {
  test("is reused across renders of one version and rebuilt for the next", () => {
    clearThemeDataUrls();
    const v1 = getThemeDataUrls(packageBundle("1.0.0"));
    expect(getThemeDataUrls(packageBundle("1.0.0"))).toBe(v1);
    const v2 = getThemeDataUrls(packageBundle("1.1.0"));
    expect(v2).not.toBe(v1);
    clearThemeDataUrls();
    expect(getThemeDataUrls(packageBundle("1.1.0"))).not.toBe(v2);
  });
});
