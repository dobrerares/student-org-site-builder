/**
 * Phase two of the package format: `render` and `public` in the manifest,
 * and a real `render.js` running end to end through the sandbox, the
 * renderer and the build (ADR 0054).
 *
 * `sandbox.test.ts` proves what a design cannot reach; this file proves what
 * a *package* has to declare, and that a declared design actually produces a
 * page. Hand-built packages throughout, so each case shows exactly which
 * line of `theme.json` it is about.
 */

import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { ThemeRenderError, renderSite } from "@sosb/renderer";
import type { ThemeBundle, ThemeRenderIssue } from "@sosb/renderer";
import { build, buildWithReport } from "@sosb/build";
import type { Site } from "@sosb/schema";
import {
  RENDER_MODULE_MAX_BYTES,
  ThemePackageError,
  exportThemePackage,
  initThemeSandbox,
  loadThemePackage,
  loadThemePackageFromZip,
} from "../src/index.js";

const HERO_ONLY = new URL("../../renderer/test/fixtures/hero-only.json", import.meta.url);
const enc = new TextEncoder();
const THEME_ID = "org.example.exec";

const MANIFEST = {
  formatVersion: 1,
  id: THEME_ID,
  name: "Exec",
  version: "1.0.0",
  builder: { formatVersion: 1 },
  css: "theme.css",
};

function pkg(manifest: unknown, files: Record<string, string> = {}): Map<string, Uint8Array> {
  const out = new Map<string, Uint8Array>();
  out.set("theme.json", enc.encode(JSON.stringify(manifest)));
  out.set("theme.css", enc.encode("body{color:red}"));
  for (const [path, body] of Object.entries(files)) out.set(path, enc.encode(body));
  return out;
}

function expectRejection(files: Map<string, Uint8Array>, code: string, message: RegExp): void {
  try {
    loadThemePackage(files);
  } catch (error) {
    expect(error).toBeInstanceOf(ThemePackageError);
    expect((error as ThemePackageError).code).toBe(code);
    expect((error as ThemePackageError).message).toMatch(message);
    return;
  }
  throw new Error(`expected loadThemePackage to reject with ${code}`);
}

const opened: ThemeBundle[] = [];
function load(files: Map<string, Uint8Array>): ThemeBundle {
  const { bundle } = loadThemePackage(files);
  opened.push(bundle);
  return bundle;
}

function site(mutate?: (s: Site) => void): Site {
  const s = JSON.parse(readFileSync(HERO_ONLY, "utf8")) as Site;
  s.theme = { id: THEME_ID };
  mutate?.(s);
  return s;
}

beforeAll(async () => {
  await initThemeSandbox();
}, 60_000);

afterAll(() => {
  for (const b of opened) b.render?.dispose();
});

describe("manifest: render", () => {
  test("names a module that must exist", () => {
    expectRejection(
      pkg({ ...MANIFEST, render: "render.js" }),
      "file-missing",
      /render\.js.*does not contain it/,
    );
  });

  test("follows the same path rules as fonts", () => {
    expectRejection(pkg({ ...MANIFEST, render: "../render.js" }), "manifest-invalid", /render/);
    expectRejection(pkg({ ...MANIFEST, render: "/render.js" }), "manifest-invalid", /render/);
  });

  test("a module over the size limit is rejected by name", () => {
    const huge = `export default { blocks: {} }; // ${"x".repeat(RENDER_MODULE_MAX_BYTES)}`;
    expectRejection(
      pkg({ ...MANIFEST, render: "render.js" }, { "render.js": huge }),
      "render-invalid",
      /KB limit/,
    );
  });

  test("a module with a syntax error or no default export is rejected at import", () => {
    expectRejection(
      pkg({ ...MANIFEST, render: "render.js" }, { "render.js": "export default { blocks: {" }),
      "render-invalid",
      /SyntaxError|unexpected/i,
    );
    expectRejection(
      pkg({ ...MANIFEST, render: "render.js" }, { "render.js": "export const blocks = {}" }),
      "render-invalid",
      /export default/,
    );
  });

  test("a module that imports another module is rejected: a package ships one design file", () => {
    expectRejection(
      pkg(
        { ...MANIFEST, render: "render.js" },
        { "render.js": 'import "./x.js"; export default { blocks: {} }' },
      ),
      "render-invalid",
      /may not import|could not load/i,
    );
  });

  test("a declarative package is still complete: no render, no public script", () => {
    const bundle = load(pkg(MANIFEST));
    expect(bundle.render).toBeUndefined();
    expect(bundle.publicScript).toBeUndefined();
  });
});

describe("manifest: public", () => {
  test("requires `network`, even when the honest answer is empty", () => {
    expectRejection(
      pkg({ ...MANIFEST, public: { file: "public.js" } }, { "public.js": "//" }),
      "manifest-invalid",
      /public\.network/,
    );
  });

  test("requires `offline` once `network` names a host", () => {
    expectRejection(
      pkg(
        { ...MANIFEST, public: { file: "public.js", network: ["api.example.org"] } },
        { "public.js": "//" },
      ),
      "manifest-invalid",
      /offline/,
    );
  });

  test("network entries are hostnames, not URLs", () => {
    expectRejection(
      pkg(
        {
          ...MANIFEST,
          public: { file: "public.js", network: ["https://api.example.org/v1"], offline: "x" },
        },
        { "public.js": "//" },
      ),
      "manifest-invalid",
      /hostname/,
    );
  });

  test("names a script that must exist", () => {
    expectRejection(
      pkg({ ...MANIFEST, public: { file: "public.js", network: [] } }),
      "file-missing",
      /public\.js.*does not contain it/,
    );
  });

  test("may not name the rendering module: render.js is never published", () => {
    expectRejection(
      pkg(
        { ...MANIFEST, render: "render.js", public: { file: "render.js", network: [] } },
        { "render.js": "export default { blocks: {} }" },
      ),
      "manifest-invalid",
      /never published/,
    );
  });

  test("is checked before the design is compiled, so a rejected package leaves no realm behind", () => {
    // Both are wrong here; the public script's missing file must be the
    // error, because it is checked first and the broken render.js is never
    // handed to the sandbox.
    expectRejection(
      pkg(
        { ...MANIFEST, render: "render.js", public: { file: "public.js", network: [] } },
        { "render.js": "export default { blocks: {" },
      ),
      "file-missing",
      /public\.js/,
    );
  });

  test("a complete declaration loads with hosts sorted and bytes verbatim", () => {
    const bundle = load(
      pkg(
        {
          ...MANIFEST,
          public: {
            file: "scripts/public.js",
            network: ["*.tiles.example.org", "api.example.org"],
            offline: "The map does not load.",
          },
        },
        { "scripts/public.js": "console.log(1)" },
      ),
    );
    expect(bundle.publicScript).toEqual({
      file: "scripts/public.js",
      bytes: enc.encode("console.log(1)"),
      network: ["*.tiles.example.org", "api.example.org"],
      offline: "The map does not load.",
    });
  });
});

const DESIGN = `
export default {
  shell(input) {
    return [
      ["header", { class: "chrome" }, ["a", { href: input.homeHref }, input.org.name], " ", input.t("menu")],
      ["slot"],
    ];
  },
  blocks: {
    hero(input) {
      return ["section", { class: "hero" }, ["h1", null, input.data.title], input.richText("**" + input.lang + "**")];
    },
    "org.example/partners"(input) {
      return ["ul", { class: "partners" }, ...input.data.items.map((item) => ["li", null, item.name])];
    },
  },
};
`;

function execPackage(): Map<string, Uint8Array> {
  return pkg(
    { ...MANIFEST, render: "render.js", public: { file: "public.js", network: [] } },
    { "render.js": DESIGN, "public.js": "(function(){})();" },
  );
}

describe("a package with render.js, end to end", () => {
  test("compiles, reports its coverage, and renders a page through the sandbox", () => {
    const bundle = load(execPackage());
    expect(bundle.render?.blockTypes).toEqual(["hero", "org.example/partners"]);
    expect(bundle.render?.hasShell).toBe(true);
    const html = renderSite(site(), THEME_ID, { theme: bundle });
    expect(html).toContain(
      '<body><header class="chrome"><a href="/">Stub Org</a> Meniu</header><main>',
    );
    expect(html).toContain(
      '<section class="hero" data-block="hero" data-block-id="blk_home_hero"><h1>Stub Org</h1>',
    );
    expect(html).toContain("<strong>ro</strong>");
  });

  test("renders a Custom Block type and omits an undesigned one, both through build()", () => {
    const bundle = load(execPackage());
    const s = site((x) => {
      x.pages[0]!.blocks.push({
        id: "blk_p",
        type: "org.example/partners",
        version: 1,
        data: { items: [{ name: "Alpha" }] },
      });
      x.pages[0]!.blocks.push({ id: "blk_q", type: "org.example/unknown", version: 1, data: {} });
    });
    const { dist, omittedBlocks } = buildWithReport(s, { themes: [bundle], skipValidation: true });
    const home = dist.get("index.html") as string;
    expect(home).toContain(
      '<ul class="partners" data-block="org.example/partners" data-block-id="blk_p"><li>Alpha</li></ul>',
    );
    expect(home).toContain("<!-- unknown block: org.example/unknown -->");
    expect(omittedBlocks.map((o) => o.blockId)).toEqual(["blk_q"]);
    expect(dist.get(`assets/theme/${THEME_ID}/public.js`)).toEqual(enc.encode("(function(){})();"));
    expect(home).toContain(
      `<script defer src="assets/theme/${THEME_ID}/public.js" data-sosb-theme-script>`,
    );
  });

  test("a design that throws stops build() and names the Theme and the Block", () => {
    const bundle = load(
      pkg(
        { ...MANIFEST, render: "render.js" },
        { "render.js": `export default { blocks: { hero() { throw new Error("kaput"); } } }` },
      ),
    );
    let caught: unknown;
    try {
      build(site(), { themes: [bundle], skipValidation: true });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ThemeRenderError);
    const error = caught as ThemeRenderError;
    expect(error.code).toBe("threw");
    expect(error.message).toBe(
      `Theme "${THEME_ID}" failed to render block blk_home_hero (hero): Error: kaput`,
    );

    // The preview shows the box and reports, rather than going blank.
    const issues: ThemeRenderIssue[] = [];
    const preview = renderSite(site(), THEME_ID, {
      theme: bundle,
      mode: "preview",
      onIssue: (issue) => issues.push(issue),
    });
    expect(preview).toContain("data-sosb-theme-error");
    expect(issues.map((i) => i.kind)).toEqual(["render-failed"]);
  });

  test("a shell with no slot is a slot-count failure attributed to the shell", () => {
    const bundle = load(
      pkg(
        { ...MANIFEST, render: "render.js" },
        { "render.js": `export default { shell() { return ["div", null, "x"]; }, blocks: {} }` },
      ),
    );
    try {
      build(site(), { themes: [bundle], skipValidation: true });
      throw new Error("expected slot-count");
    } catch (error) {
      expect(error).toBeInstanceOf(ThemeRenderError);
      expect((error as ThemeRenderError).code).toBe("slot-count");
      expect((error as ThemeRenderError).subject).toBe("shell");
    }
  });

  test("an invalid tree is an invalid-tree failure naming the offending node", () => {
    const bundle = load(
      pkg(
        { ...MANIFEST, render: "render.js" },
        {
          "render.js": `export default { blocks: { hero() { return ["div", { onclick: "x()" }]; } } }`,
        },
      ),
    );
    try {
      renderSite(site(), THEME_ID, { theme: bundle });
      throw new Error("expected invalid-tree");
    } catch (error) {
      expect((error as ThemeRenderError).code).toBe("invalid-tree");
      expect((error as ThemeRenderError).message).toMatch(/onclick/);
    }
  });

  test("the same Site renders identically through two separately loaded realms", () => {
    const first = load(execPackage());
    const second = load(execPackage());
    const s = site();
    const a = renderSite(s, THEME_ID, { theme: first });
    const b = renderSite(s, THEME_ID, { theme: second });
    const again = renderSite(s, THEME_ID, { theme: first });
    expect(b).toBe(a);
    expect(again).toBe(a);
  });

  test("round-trips through a .sosb-theme.zip byte for byte, render.js and public.js included", async () => {
    const files = execPackage();
    const loaded = loadThemePackage(files);
    opened.push(loaded.bundle);
    const zipped = exportThemePackage(loaded);
    const reloaded = await loadThemePackageFromZip(zipped);
    opened.push(reloaded.bundle);
    expect([...reloaded.files.keys()].sort()).toEqual([...files.keys()].sort());
    for (const [path, bytes] of files) expect(reloaded.files.get(path)).toEqual(bytes);
    expect(reloaded.bundle.publicScript).toEqual(loaded.bundle.publicScript);
    expect(reloaded.bundle.render?.blockTypes).toEqual(loaded.bundle.render?.blockTypes);
    expect(exportThemePackage(reloaded)).toEqual(zipped);
  });
});
