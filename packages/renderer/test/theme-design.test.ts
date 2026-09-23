/**
 * The executable Theme rendering contract, exercised without an engine.
 *
 * `ThemeRenderModule` is an interface with synchronous methods (ADR 0054), so
 * a hand-written object is a perfectly good design for testing what the
 * *renderer* does with one: which attributes it stamps, which trees it
 * refuses, how a failure surfaces in each mode, and what a shell may and may
 * not do to the document. The QuickJS-backed implementation is tested in
 * `@sosb/theme-package`; nothing here depends on it.
 */

import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import heroOnly from "./fixtures/hero-only.json" with { type: "json" };
import {
  THEME_COPY_KEYS,
  ThemeRenderError,
  blockHasDesign,
  omittedBlocksFor,
  renderSite,
  themeAssetsFor,
} from "../src/index.js";
import type {
  ThemeBundle,
  ThemeRenderHelpers,
  ThemeRenderIssue,
  ThemeRenderModule,
} from "../src/index.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Input = any;

interface Design {
  readonly blocks?: Record<string, (input: Input, helpers: ThemeRenderHelpers) => unknown>;
  readonly shell?: (input: Input, helpers: ThemeRenderHelpers) => unknown;
}

function moduleFrom(design: Design): ThemeRenderModule {
  return {
    blockTypes: Object.keys(design.blocks ?? {}).sort(),
    hasShell: design.shell !== undefined,
    renderBlock(type, input, helpers) {
      return design.blocks![type]!(input, helpers);
    },
    renderShell(input, helpers) {
      return design.shell!(input, helpers);
    },
    dispose() {},
  };
}

const THEME_ID = "org.example.fake";

function bundleWith(design: Design | undefined, extra: Partial<ThemeBundle> = {}): ThemeBundle {
  return {
    id: THEME_ID,
    name: "Fake",
    version: "1.0.0",
    origin: "package",
    css: "",
    baselineTokens: [],
    supports: { colors: true, fonts: true, density: true, radius: true },
    blockVariants: {},
    shellVariants: [],
    fontSource: { kind: "registry" },
    assets: new Map(),
    render: design === undefined ? undefined : moduleFrom(design),
    ...extra,
  };
}

function siteFor(mutate?: (site: Site) => void): Site {
  const site = structuredClone(heroOnly) as unknown as Site;
  site.theme = { id: THEME_ID };
  mutate?.(site);
  return site;
}

const CUSTOM_BLOCK = {
  id: "blk_partners",
  type: "org.example/partners",
  version: 1,
  data: { items: [{ name: "Alpha" }, { name: "Beta" }] },
} as const;

function render(
  site: Site,
  bundle: ThemeBundle,
  opts: {
    mode?: "deploy" | "preview";
    pageIndex?: number;
    issues?: ThemeRenderIssue[];
    publicScript?: boolean;
    resolver?: (p: string) => string;
  } = {},
): string {
  return renderSite(site, THEME_ID, {
    theme: bundle,
    mode: opts.mode ?? "deploy",
    pageIndex: opts.pageIndex ?? 0,
    onIssue: opts.issues === undefined ? undefined : (issue) => opts.issues!.push(issue),
    includePublicScript: opts.publicScript,
    assetUrlForPath: opts.resolver,
  });
}

function expectRenderError(fn: () => unknown, code: string, message: RegExp): ThemeRenderError {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(ThemeRenderError);
    const typed = error as ThemeRenderError;
    expect(typed.code).toBe(code);
    expect(typed.message).toMatch(message);
    return typed;
  }
  throw new Error(`expected a ThemeRenderError(${code})`);
}

describe("a Block design", () => {
  test("has the builder's addressing attributes stamped onto its root", () => {
    const bundle = bundleWith(
      { blocks: { hero: (i) => ["section", { class: "x" }, ["h1", null, i.data.title]] } },
      { blockVariants: { hero: [{ id: "split", label: "Split" }] } },
    );
    const plain = render(siteFor(), bundle);
    expect(plain).toContain(
      '<section class="x" data-block="hero" data-block-id="blk_home_hero"><h1>Stub Org</h1></section>',
    );

    const withVariant = render(
      siteFor((s) => {
        (s.pages[0]!.blocks[0] as { variant?: string }).variant = "split";
      }),
      bundle,
    );
    expect(withVariant).toContain(
      'data-block="hero" data-block-id="blk_home_hero" data-variant="split"',
    );

    // A variant the Theme does not offer is suspended, not emitted.
    const stale = render(
      siteFor((s) => {
        (s.pages[0]!.blocks[0] as { variant?: string }).variant = "nope";
      }),
      bundle,
    );
    expect(stale).not.toContain("data-variant");
  });

  test("renders a Custom Block type the built-ins know nothing about", () => {
    const bundle = bundleWith({
      blocks: {
        "org.example/partners": (i) => [
          "ul",
          { class: "partners" },
          ...i.data.items.map((item: { name: string }) => ["li", null, item.name]),
        ],
      },
    });
    const html = render(
      siteFor((s) => s.pages[0]!.blocks.push(structuredClone(CUSTOM_BLOCK))),
      bundle,
    );
    expect(html).toContain(
      '<ul class="partners" data-block="org.example/partners" data-block-id="blk_partners"><li>Alpha</li><li>Beta</li></ul>',
    );
  });

  test("receives the envelope, its surroundings and the Theme settings — nothing else", () => {
    let seen: string[] = [];
    const bundle = bundleWith({
      blocks: {
        hero: (i) => {
          seen = Object.keys(i).sort();
          return [
            "div",
            null,
            i.document.kind,
            ":",
            i.org.name,
            ":",
            i.theme.id,
            ":",
            String(i.variant),
          ];
        },
      },
    });
    const html = render(siteFor(), bundle);
    expect(seen).toEqual([
      "data",
      "document",
      "id",
      "lang",
      "org",
      "theme",
      "type",
      "variant",
      "version",
    ]);
    expect(html).toContain(
      'data-block-id="blk_home_hero">page:Stub Org:org.example.fake:null</div>',
    );
  });

  test("may return null to render nothing, but never a fragment as its root", () => {
    const nothing = bundleWith({ blocks: { hero: () => null } });
    const html = render(siteFor(), nothing);
    expect(html).toContain("<main></main>");
    // Rendering nothing on purpose is not the same as having no design.
    expect(html).not.toContain("unknown block");

    const fragment = bundleWith({
      blocks: {
        hero: () => [
          ["p", null, "a"],
          ["p", null, "b"],
        ],
      },
    });
    expectRenderError(() => render(siteFor(), fragment), "invalid-tree", /single element/);
  });
});

describe("what a tree may not contain", () => {
  const cases: [string, unknown, RegExp][] = [
    ["a script element", ["script", null, "alert(1)"], /<script> is not an element/],
    ["an iframe", ["iframe", { src: "https://x.test" }], /<iframe> is not an element/],
    ["a style element", ["style", null, "body{}"], /<style> is not an element/],
    ["an event handler", ["div", { onclick: "x()" }], /event handler attribute "onclick"/],
    ["an inline style", ["div", { style: "color:red" }], /"style" attribute/],
    ["a javascript: URL", ["a", { href: "javascript:alert(1)" }, "x"], /not an acceptable URL/],
    [
      "a protocol-relative URL",
      ["img", { src: "//cdn.test/x.png", alt: "" }],
      /not an acceptable URL/,
    ],
    [
      "a data: URL in an image",
      ["img", { src: "data:image/png;base64,AAAA", alt: "" }],
      /not an acceptable URL/,
    ],
    [
      "a builder-owned attribute",
      ["div", { "data-block-id": "spoof" }],
      /"data-block-id", which the builder places/,
    ],
    ["an unsupported attribute", ["div", { srcdoc: "x" }], /unsupported attribute "srcdoc"/],
    ["an SVG <use>", ["svg", null, ["use", { href: "#x" }]], /<use> is not an element/],
    ["a content slot outside the shell", ["div", null, ["slot"]], /only appear in a shell/],
  ];
  test.each(cases)("%s is refused with a locatable error", (_name, tree, message) => {
    const bundle = bundleWith({ blocks: { hero: () => tree } });
    const error = expectRenderError(() => render(siteFor(), bundle), "invalid-tree", message);
    expect(error.themeId).toBe(THEME_ID);
    expect(error.subject).toBe("blk_home_hero");
    expect(error.blockType).toBe("hero");
  });

  test("helper-produced URLs pass by identity — including a preview blob URL", () => {
    const bundle = bundleWith({
      blocks: {
        hero: (i, h) => [
          "div",
          null,
          [
            "img",
            { src: h.mediaUrl(i.data.backgroundImage), alt: h.mediaAlt(i.data.backgroundImage) },
          ],
          ["a", { href: h.pageUrl("ro:acasa") }, "home"],
          ["img", { src: h.asset("assets/x.svg"), alt: "" }],
        ],
      },
    });
    const html = render(siteFor(), bundle, { mode: "preview", resolver: (p) => `blob:sosb/${p}` });
    // Attributes are emitted in sorted order — one more thing a design
    // cannot vary between preview and export.
    expect(html).toContain('<img alt="Studenți la o conferință" src="blob:sosb/assets/hero.jpg"/>');
    expect(html).toContain('<a href="/">home</a>');
    expect(html).toContain(
      // An empty-string attribute renders bare, as documented.
      '<img alt src="blob:sosb/assets/theme/org.example.fake/assets/x.svg"/>',
    );

    // The same blob URL typed out by hand is not trusted: only the helper's
    // own return value is.
    const spoof = bundleWith({
      blocks: { hero: () => ["img", { src: "blob:sosb/assets/hero.jpg", alt: "" }] },
    });
    expectRenderError(
      () => render(siteFor(), spoof, { mode: "deploy" }),
      "invalid-tree",
      /not an acceptable URL/,
    );
  });

  test("mediaUrl() answers null for anything that is not a Site asset path", () => {
    // The helper's return value is trusted by identity, so its *input* must
    // be something the builder would have minted a URL for. A design cannot
    // launder a scheme, a protocol-relative host or a path escape through it.
    const bundle = bundleWith({
      blocks: {
        hero: (i, h) => [
          "p",
          {
            "data-js": String(h.mediaUrl("javascript:alert(1)")),
            "data-host": String(h.mediaUrl({ path: "//evil.test/x.png" })),
            "data-up": String(h.mediaUrl("assets/../../index.html")),
            "data-quote": String(h.mediaUrl('assets/x".png')),
            "data-real": String(h.mediaUrl(i.data.backgroundImage)),
          },
        ],
      },
    });
    expect(render(siteFor(), bundle)).toContain(
      '<p data-host="null" data-js="null" data-quote="null" data-real="assets/hero.jpg" data-up="null"',
    );
  });

  test("asset() refuses a path that could not be a package file", () => {
    const bundle = bundleWith({
      blocks: { hero: (_i, h) => ["img", { src: h.asset("../../etc/passwd"), alt: "" }] },
    });
    const error = expectRenderError(() => render(siteFor(), bundle), "threw", /package-relative/);
    expect(error.subject).toBe("blk_home_hero");
    const scheme = bundleWith({
      blocks: { hero: (_i, h) => ["img", { src: h.asset("javascript:alert(1)"), alt: "" }] },
    });
    expectRenderError(() => render(siteFor(), scheme), "threw", /package-relative/);
  });

  test("srcset is checked one candidate at a time", () => {
    const fine = bundleWith({
      blocks: {
        hero: (_i, h) => [
          "img",
          {
            alt: "",
            src: h.asset("assets/a.png"),
            srcset: `${h.asset("assets/a.png")} 1x, ${h.asset("assets/b.png")} 2x`,
          },
        ],
      },
    });
    expect(render(siteFor(), fine)).toContain(
      'srcset="assets/theme/org.example.fake/assets/a.png 1x, assets/theme/org.example.fake/assets/b.png 2x"',
    );
    // A safe first candidate does not vouch for the second.
    const smuggled = bundleWith({
      blocks: {
        hero: () => ["img", { alt: "", srcset: "https://cdn.test/a.png 1x, //evil.test/b.png 2x" }],
      },
    });
    expectRenderError(
      () => render(siteFor(), smuggled),
      "invalid-tree",
      /"srcset" is not an acceptable URL \("\/\/evil\.test/,
    );
    // Two URLs with no descriptor between them is not a candidate list.
    const malformed = bundleWith({
      blocks: { hero: () => ["img", { alt: "", srcset: "assets/a.png assets/b.png 2x" }] },
    });
    expectRenderError(() => render(siteFor(), malformed), "invalid-tree", /well-formed candidate/);
  });

  test("an attribute name that is not a plain name is refused, not silently dropped", () => {
    const bundle = bundleWith({
      blocks: { hero: () => ["div", { "data-a onmouseover=alert(1)": "1" }] },
    });
    expectRenderError(() => render(siteFor(), bundle), "invalid-tree", /invalid name/);
  });

  test("a new-tab link gets noopener noreferrer whether the design asked or not", () => {
    const bundle = bundleWith({
      blocks: {
        hero: () => ["a", { href: "https://example.org", target: "_blank", rel: "external" }, "x"],
      },
    });
    expect(render(siteFor(), bundle)).toContain(
      'rel="external noopener noreferrer" target="_blank"',
    );
  });

  test("richText() places builder-rendered prose, never the design's own markup", () => {
    const bundle = bundleWith({
      blocks: {
        hero: (_i, h) => ["div", { class: "prose" }, h.richText("**bold** and <script>x</script>")],
      },
    });
    const html = render(siteFor(), bundle);
    expect(html).toContain('<div class="rich-text">');
    expect(html).toContain("<strong>bold</strong>");
    expect(html).not.toContain("<script>x</script>");
  });

  test("t() answers in the page's language and echoes unknown keys", () => {
    const bundle = bundleWith({
      blocks: {
        hero: (_i, h) => ["p", null, h.t("menu"), "|", h.t("publishedOn"), "|", h.t("nope")],
      },
    });
    expect(render(siteFor(), bundle)).toContain("<p");
    expect(render(siteFor(), bundle)).toContain(">Meniu|Publicat pe|nope</p>");
    const english = siteFor((s) => {
      s.languages = ["en"];
      s.defaultLanguage = "en";
      s.pages[0]!.lang = "en";
    });
    expect(render(english, bundle)).toContain(">Menu|Published on|nope</p>");
    expect(THEME_COPY_KEYS).toContain("menu");
    expect(THEME_COPY_KEYS).toContain("publishedOn");
  });
});

describe("failure surfaces per mode", () => {
  const throwing = bundleWith({
    blocks: {
      hero: () => {
        throw new Error("kaput");
      },
    },
  });

  test("deploy mode rethrows, naming the Theme and the Block", () => {
    const error = expectRenderError(() => render(siteFor(), throwing), "threw", /kaput/);
    expect(error.message).toBe(
      'Theme "org.example.fake" failed to render block blk_home_hero (hero): kaput',
    );
  });

  test("preview mode reports through onIssue and renders a builder-owned box", () => {
    const issues: ThemeRenderIssue[] = [];
    const html = render(siteFor(), throwing, { mode: "preview", issues });
    expect(html).toContain('data-sosb-theme-error role="alert" lang="ro"');
    expect(html).toContain("Această temă nu a putut afișa această parte a paginii.");
    expect(html).toContain("kaput");
    const english = siteFor((s) => {
      s.languages = ["en"];
      s.defaultLanguage = "en";
      s.pages[0]!.lang = "en";
    });
    expect(render(english, throwing, { mode: "preview" })).toContain(
      "This Theme could not render this part of the page.",
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]!.kind).toBe("render-failed");
    if (issues[0]!.kind === "render-failed") {
      expect(issues[0]!.error.subject).toBe("blk_home_hero");
      expect(issues[0]!.document.id).toBe("ro:acasa");
    }
  });
});

describe("a shell design", () => {
  test("wraps the builder's content exactly once and keeps the head", () => {
    const bundle = bundleWith({
      shell: (i) => [
        ["header", { class: "chrome" }, ["a", { href: i.homeHref }, i.org.name], i.title],
        ["slot"],
        ["section", { class: "colophon", "aria-label": i.org.name }, i.kind],
      ],
    });
    const html = render(siteFor(), bundle);
    expect(html).toContain("<title>Stub site — home</title>");
    expect(html).toContain(
      '<body><header class="chrome"><a href="/">Stub Org</a>Stub site — home</header><main><section data-block="hero"',
    );
    expect(html).toContain('<section aria-label="Stub Org" class="colophon">page</section>');
    expect(html).toContain('data-block="hero"');
  });

  test("sees the builder's navigation, language links and title — the same values it renders itself", () => {
    let seen: string[] = [];
    let nav: unknown;
    const bundle = bundleWith({
      shell: (i) => {
        seen = Object.keys(i).sort();
        nav = i.nav;
        return ["slot"];
      },
    });
    render(
      siteFor((s) => {
        s.pages.push({
          ...structuredClone(s.pages[0]!),
          slug: "despre",
          navLabel: "Despre",
          navOrder: 1,
        });
      }),
      bundle,
    );
    expect(seen).toEqual([
      "description",
      "document",
      "homeHref",
      "kind",
      "lang",
      "languages",
      "nav",
      "org",
      "theme",
      "title",
    ]);
    expect(nav).toEqual([
      { id: "ro:acasa", label: "Acasă", href: "/", isActive: true },
      { id: "ro:despre", label: "Despre", href: "/despre/", isActive: false },
    ]);
  });

  test("with no slot, or with two, the render fails as slot-count", () => {
    const none = bundleWith({ shell: () => ["div", null, "no content"] });
    const error = expectRenderError(
      () => render(siteFor(), none),
      "slot-count",
      /no \["slot"\] node/,
    );
    expect(error.subject).toBe("shell");
    expect(error.blockType).toBeUndefined();

    const two = bundleWith({ shell: () => ["div", null, ["slot"], ["slot"]] });
    expectRenderError(() => render(siteFor(), two), "slot-count", /2 \["slot"\] nodes/);
  });

  test("in preview a failed shell falls back to the builder's own, with the box on top", () => {
    const issues: ThemeRenderIssue[] = [];
    const none = bundleWith({ shell: () => ["div", null, "no content"] });
    const html = render(siteFor(), none, { mode: "preview", issues });
    expect(html).toContain("data-sosb-theme-error");
    expect(html).toContain('<main><section data-block="hero"');
    expect(issues.map((i) => i.kind)).toEqual(["render-failed"]);
  });

  test("cannot emit html, head or body, and cannot set the shell variant itself", () => {
    const body = bundleWith({ shell: () => ["body", null, ["slot"]] });
    expectRenderError(() => render(siteFor(), body), "invalid-tree", /<body> is not an element/);
    const variant = bundleWith({ shell: () => ["div", { "data-shell-variant": "x" }, ["slot"]] });
    expectRenderError(() => render(siteFor(), variant), "invalid-tree", /data-shell-variant/);
  });
});

describe("omitted Blocks (ADR 0045)", () => {
  const withCustom = (): Site =>
    siteFor((s) => s.pages[0]!.blocks.push(structuredClone(CUSTOM_BLOCK)));

  test("a Block with no design is left out, marked, and reported exactly once", () => {
    const issues: ThemeRenderIssue[] = [];
    const html = render(
      withCustom(),
      bundleWith({ blocks: { hero: (i) => ["h1", null, i.data.title] } }),
      {
        issues,
      },
    );
    expect(html).toContain("<!-- unknown block: org.example/partners -->");
    expect(issues).toEqual([
      {
        kind: "omitted-block",
        omitted: {
          document: { kind: "page", id: "ro:acasa", title: "Stub site — home", lang: "ro" },
          blockId: "blk_partners",
          blockType: "org.example/partners",
        },
      },
    ]);
  });

  test("the static pre-flight list agrees with what the render reports", () => {
    const bundle = bundleWith(undefined);
    const site = withCustom();
    const issues: ThemeRenderIssue[] = [];
    render(site, bundle, { issues });
    const reported = issues.flatMap((i) => (i.kind === "omitted-block" ? [i.omitted] : []));
    expect(omittedBlocksFor(site, bundle)).toEqual(reported);
    // Under a built-in Theme the rule is the same: a Custom Block has no design.
    expect(omittedBlocksFor(site, undefined)).toEqual(reported);
    expect(blockHasDesign(undefined, "hero")).toBe(true);
    expect(blockHasDesign(undefined, "org.example/partners")).toBe(false);
  });

  test("a built-in Block that renders nothing for empty data is not an omission", () => {
    const issues: ThemeRenderIssue[] = [];
    const site = siteFor((s) =>
      s.pages[0]!.blocks.push({ id: "blk_footer", type: "siteFooter", version: 1, data: {} }),
    );
    const html = render(site, bundleWith(undefined), { issues });
    expect(html).not.toContain("unknown block");
    expect(issues).toEqual([]);
    expect(omittedBlocksFor(site, undefined)).toEqual([]);
  });

  test("Draft Articles are not published, so their Blocks cannot be omitted", () => {
    const site = siteFor((s) => {
      s.articles = [
        {
          id: "art_1",
          slug: "x",
          lang: "ro",
          title: "X",
          state: "draft",
          publishedAt: "2026-01-01",
          blocks: [structuredClone(CUSTOM_BLOCK)],
        } as unknown as Site["articles"] extends readonly (infer A)[] | undefined ? A : never,
      ];
    });
    expect(omittedBlocksFor(site, undefined)).toEqual([]);
  });
});

describe("the public-site script", () => {
  const withScript = bundleWith(undefined, {
    publicScript: {
      file: "public.js",
      bytes: new Uint8Array([1, 2, 3]),
      network: [],
      offline: undefined,
    },
  });
  const twoPages = (): Site =>
    siteFor((s) => {
      s.pages.push({
        ...structuredClone(s.pages[0]!),
        slug: "despre",
        navLabel: "Despre",
        navOrder: 1,
      });
    });

  test("is off by default and on only when asked, with a depth-aware URL", () => {
    expect(render(twoPages(), withScript)).not.toContain("data-sosb-theme-script");
    expect(render(twoPages(), withScript, { publicScript: true })).toContain(
      '<script defer src="assets/theme/org.example.fake/public.js" data-sosb-theme-script></script>',
    );
    expect(render(twoPages(), withScript, { publicScript: true, pageIndex: 1 })).toContain(
      '<script defer src="../assets/theme/org.example.fake/public.js" data-sosb-theme-script></script>',
    );
    // The preview resolver wins, exactly as for fonts and images.
    expect(
      render(twoPages(), withScript, { publicScript: true, resolver: (p) => `blob:sosb/${p}` }),
    ).toContain('src="blob:sosb/assets/theme/org.example.fake/public.js"');
  });

  test("rides the same asset path table as the Theme's fonts and images", () => {
    expect([...themeAssetsFor(withScript).keys()]).toEqual([
      "assets/theme/org.example.fake/public.js",
    ]);
  });

  test("a Theme without one emits nothing even when asked", () => {
    expect(render(siteFor(), bundleWith(undefined), { publicScript: true })).not.toContain(
      "data-sosb-theme-script",
    );
  });
});

describe("built-in Themes are untouched", () => {
  test("the issue sink and the public-script flag change no bytes for a built-in", () => {
    const site = heroOnly as unknown as Site;
    const baseline = renderSite(site, "modern");
    const issues: ThemeRenderIssue[] = [];
    const withOptions = renderSite(site, "modern", {
      onIssue: (issue) => issues.push(issue),
      includePublicScript: true,
    });
    expect(withOptions).toBe(baseline);
    expect(issues).toEqual([]);
  });
});
