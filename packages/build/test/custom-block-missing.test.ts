/**
 * `build()` refuses to export a Site holding a Custom Block whose type no
 * supplied package declares (ADR 0055; issue-106 plan, "missing required
 * extension"). Distinct from the omission path: a *declared* type the Theme
 * does not design is left out with an acknowledgement, not refused.
 */
import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import type { ThemeBundle } from "@sosb/renderer";
import singlePageSite from "./fixtures/single-page-site.json" with { type: "json" };
import { BuildCustomBlockMissingError, build, buildWithReport } from "../src/index.js";

const PARTNERS = {
  formatVersion: 1 as const,
  type: "org.example/partners",
  version: 1,
  label: "Partners",
  fields: [{ name: "heading", kind: "text" as const, label: "Heading" }],
};

function siteWithPartners(): Site {
  const site = structuredClone(singlePageSite) as unknown as Site;
  site.pages[0]!.blocks.push({
    id: "blk_partners",
    type: "org.example/partners",
    version: 1,
    data: { heading: "Keep me" },
  });
  return site;
}

/** A declarative package that declares the type but designs nothing. */
const declaring = {
  id: "org.example.decl",
  name: "Declaring",
  version: "1.0.0",
  origin: "package",
  css: "",
  baselineTokens: [],
  supports: { colors: true, fonts: true, density: true, radius: true },
  blockVariants: {},
  shellVariants: [],
  fontSource: { kind: "registry" },
  assets: new Map<string, Uint8Array>(),
  customBlocks: [PARTNERS],
} as unknown as ThemeBundle;

describe("build with Custom Blocks", () => {
  test("throws BuildCustomBlockMissingError when no supplied package declares the type", () => {
    expect(() => build(siteWithPartners(), { skipValidation: true })).toThrow(
      BuildCustomBlockMissingError,
    );
    try {
      build(siteWithPartners(), { skipValidation: true });
    } catch (error) {
      const missing = error as BuildCustomBlockMissingError;
      expect(missing.blockType).toBe("org.example/partners");
      expect(missing.blockId).toBe("blk_partners");
      expect(missing.reason).toBe("package-missing");
      expect(missing.message).toContain("org.example/partners");
    }
  });

  test("a Block saved by a newer package than the one supplied is refused too", () => {
    const site = siteWithPartners();
    site.pages[0]!.blocks.at(-1)!.version = 2;
    let caught: unknown;
    try {
      build(site, { skipValidation: true, themes: [declaring] });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(BuildCustomBlockMissingError);
    expect((caught as BuildCustomBlockMissingError).reason).toBe("data-newer");
    expect((caught as BuildCustomBlockMissingError).message).toContain("newer version");
    // Older data is fine: the editor's update flow adapts it, the build renders it.
    site.pages[0]!.blocks.at(-1)!.version = 0;
    expect(() => build(site, { skipValidation: true, themes: [declaring] })).not.toThrow();
  });

  test("a declared but undesigned type is omitted with a report, not refused", () => {
    // The Site stays on the built-in stub Theme; the declaring package is
    // merely *supplied*, which is how the editor passes every installed one.
    const { dist, omittedBlocks } = buildWithReport(siteWithPartners(), {
      skipValidation: true,
      themes: [declaring],
    });
    expect(omittedBlocks.map((o) => o.blockId)).toEqual(["blk_partners"]);
    expect(dist.get("index.html")).toContain("<!-- unknown block: org.example/partners -->");
  });

  test("a Custom Block inside a Draft Article does not stop the build", () => {
    const site = structuredClone(singlePageSite) as unknown as Site;
    site.articles = [
      {
        id: "a1",
        lang: "ro",
        slug: "draft",
        title: "Draft",
        state: "draft",
        publishedAt: "2026-01-01",
        blocks: [{ id: "b", type: "org.example/partners", version: 1, data: {} }],
      } as unknown as NonNullable<Site["articles"]>[number],
    ];
    expect(() => build(site, { skipValidation: true })).not.toThrow();
  });

  test("a non-namespaced unknown type is still the forward-compatible unknown-block path", () => {
    const site = structuredClone(singlePageSite) as unknown as Site;
    site.pages[0]!.blocks.push({ id: "b", type: "futureBlock", version: 1, data: {} });
    expect(() => build(site, { skipValidation: true })).not.toThrow();
  });
});
