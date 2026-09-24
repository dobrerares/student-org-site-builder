/**
 * `build()` and a Theme's executable design (ADR 0045, ADR 0054).
 *
 * Three promises the pipeline makes to the editor:
 *
 *  - Blocks left out for want of a design are *reported*, in output order,
 *    and the build still completes — the author acknowledges, the Site ships.
 *  - A design that fails *stops* the build with an error naming the Theme and
 *    the Block. No acknowledgement flow reaches it.
 *  - The Theme's public-site script is written into `dist/`, referenced from
 *    every page, and exempt from the builder's own script budget (ADR 0046).
 *
 * The design is a hand-written `ThemeRenderModule`; the build pipeline does
 * not know or care that the real one is QuickJS.
 */

import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import { ThemeRenderError, omittedBlocksFor } from "@sosb/renderer";
import type { ThemeBundle, ThemeRenderHelpers, ThemeRenderModule } from "@sosb/renderer";
import { BUDGET_LIMITS, build, buildWithReport, measureBudgets } from "../src/index.js";

const HERO_ONLY = new URL("../../renderer/test/fixtures/hero-only.json", import.meta.url);
const THEME_ID = "org.example.buildfake";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Input = any;

function moduleFrom(design: {
  blocks?: Record<string, (input: Input, helpers: ThemeRenderHelpers) => unknown>;
  shell?: (input: Input) => unknown;
}): ThemeRenderModule {
  return {
    blockTypes: Object.keys(design.blocks ?? {}).sort(),
    hasShell: design.shell !== undefined,
    renderBlock: (type, input, helpers) => design.blocks![type]!(input, helpers),
    renderShell: (input) => design.shell!(input),
    dispose() {},
  };
}

function bundle(extra: Partial<ThemeBundle> = {}): ThemeBundle {
  return {
    id: THEME_ID,
    name: "Build fake",
    version: "1.0.0",
    origin: "package",
    css: "",
    baselineTokens: [],
    supports: { colors: true, fonts: true, density: true, radius: true },
    blockVariants: {},
    shellVariants: [],
    fontSource: { kind: "registry" },
    assets: new Map(),
    // The Custom Block type is *declared* (ADR 0055), so a Theme without a
    // design for it produces an omission (ADR 0045) rather than the
    // missing-declaration refusal `custom-block-missing.test.ts` covers.
    customBlocks: [
      {
        formatVersion: 1,
        type: "org.example/partners",
        version: 1,
        label: "Partners",
        fields: [{ name: "heading", kind: "text", label: "Heading" }],
      },
    ],
    ...extra,
  };
}

function site(mutate?: (s: Site) => void): Site {
  const s = JSON.parse(readFileSync(HERO_ONLY, "utf8")) as Site;
  s.theme = { id: THEME_ID };
  s.pages.push({ ...structuredClone(s.pages[0]!), slug: "despre", navLabel: "Despre", navOrder: 1 });
  mutate?.(s);
  return s;
}

const CUSTOM = { id: "blk_custom", type: "org.example/partners", version: 1, data: {} };

describe("omitted Blocks", () => {
  test("buildWithReport returns them in output order and still builds every page", () => {
    const s = site((x) => {
      x.pages[1]!.blocks.push(structuredClone(CUSTOM));
      x.pages[0]!.blocks.push({ ...structuredClone(CUSTOM), id: "blk_custom_home" });
    });
    const { dist, omittedBlocks } = buildWithReport(s, { themes: [bundle()], skipValidation: true });
    expect([...dist.keys()]).toContain("despre/index.html");
    expect(omittedBlocks.map((o) => [o.document.id, o.blockId, o.blockType])).toEqual([
      ["ro:acasa", "blk_custom_home", "org.example/partners"],
      ["ro:despre", "blk_custom", "org.example/partners"],
    ]);
    // The editor's pre-flight list is the same list.
    expect(omittedBlocksFor(s, bundle())).toEqual(omittedBlocks);
  });

  test("build() reports through onOmittedBlock, once per Block", () => {
    const seen: string[] = [];
    build(site((x) => x.pages[0]!.blocks.push(structuredClone(CUSTOM))), {
      themes: [bundle()],
      skipValidation: true,
      onOmittedBlock: (o) => seen.push(o.blockId),
    });
    expect(seen).toEqual(["blk_custom"]);
  });

  test("a design for the type means nothing is omitted", () => {
    const designed = bundle({
      render: moduleFrom({ blocks: { "org.example/partners": () => ["ul", { class: "p" }] } }),
    });
    const { dist, omittedBlocks } = buildWithReport(
      site((x) => x.pages[0]!.blocks.push(structuredClone(CUSTOM))),
      { themes: [designed], skipValidation: true },
    );
    expect(omittedBlocks).toEqual([]);
    expect(dist.get("index.html")).toContain('<ul class="p" data-block="org.example/partners"');
  });
});

describe("rendering failures", () => {
  test("a throwing Block design stops the build and names Theme and Block", () => {
    const broken = bundle({
      render: moduleFrom({
        blocks: {
          hero: () => {
            throw new Error("kaput");
          },
        },
      }),
    });
    let caught: unknown;
    try {
      build(site(), { themes: [broken], skipValidation: true });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ThemeRenderError);
    expect((caught as ThemeRenderError).message).toBe(
      `Theme "${THEME_ID}" failed to render block blk_home_hero (hero): kaput`,
    );
  });

  test("a shell without a content slot stops the build as slot-count", () => {
    const broken = bundle({ render: moduleFrom({ shell: () => ["div", null, "nothing"] }) });
    expect(() => build(site(), { themes: [broken], skipValidation: true })).toThrow(ThemeRenderError);
    try {
      build(site(), { themes: [broken], skipValidation: true });
    } catch (error) {
      expect((error as ThemeRenderError).code).toBe("slot-count");
      expect((error as ThemeRenderError).subject).toBe("shell");
    }
  });
});

describe("the public-site script", () => {
  const scriptBytes = new TextEncoder().encode("x".repeat(20 * 1024));
  const withScript = bundle({
    publicScript: { file: "public.js", bytes: scriptBytes, network: [], offline: undefined },
  });

  test("is written into dist and referenced from every page at its own depth", () => {
    const dist = build(site(), { themes: [withScript], skipValidation: true });
    expect(dist.get(`assets/theme/${THEME_ID}/public.js`)).toEqual(scriptBytes);
    expect(dist.get("index.html")).toContain(
      `<script defer src="assets/theme/${THEME_ID}/public.js" data-sosb-theme-script></script>`,
    );
    expect(dist.get("despre/index.html")).toContain(
      `<script defer src="../assets/theme/${THEME_ID}/public.js" data-sosb-theme-script></script>`,
    );
  });

  test("does not count against the builder's script budget, which still polices everything else", () => {
    const dist = build(site(), { themes: [withScript], skipValidation: true });
    const report = measureBudgets(dist);
    for (const page of Object.values(report.pages)) {
      expect(page.metrics.js.status).toBe("pass");
    }
    // `errorOnBudget` must not fail because of the exempt script. Package-Theme
    // pages already exceed the HTML budget on their own (the inlined base
    // stylesheet, see ADR 0054), so only the script lines are checked here.
    let thrown: unknown;
    try {
      build(site(), { themes: [withScript], skipValidation: true, errorOnBudget: true });
    } catch (error) {
      thrown = error;
    }
    if (thrown !== undefined) {
      expect(String(thrown)).not.toMatch(/ js: /);
    }

    // The same 20 KB under a builder path is over budget: the exemption is
    // scoped to `assets/theme/`, not to external scripts in general.
    const home = dist.get("index.html") as string;
    const rogue = new Map<string, string | Uint8Array>(dist);
    rogue.set("assets/site.js", "x".repeat(20 * 1024));
    rogue.set("index.html", home.replace("</body>", '<script src="assets/site.js"></script></body>'));
    expect(measureBudgets(rogue).pages["index.html"]!.metrics.js.status).toBe("warn");
    expect(BUDGET_LIMITS.js).toBe(10 * 1024);
  });
});

describe("built-in Themes", () => {
  test("produce the same bytes with the new options as without", () => {
    const s = JSON.parse(readFileSync(HERO_ONLY, "utf8")) as Site;
    const before = build(s, { skipValidation: true });
    const after = build(s, { skipValidation: true, onOmittedBlock: () => undefined });
    expect([...after.entries()]).toEqual([...before.entries()]);
    expect(before.get("index.html")).not.toContain("data-sosb-theme-script");
  });
});
