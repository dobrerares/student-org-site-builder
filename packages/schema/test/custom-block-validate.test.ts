/**
 * `validate()` with Custom Block data (ADR 0055).
 *
 * Every content rule is a warning the author can acknowledge; an unavailable
 * type is a blocking error at the Block; content is never truncated — the
 * result only *reports*. The Draft carve-out applies as it does everywhere
 * else: an unavailable Block inside a Draft Article is an ordinary error.
 */
import { describe, expect, test } from "vitest";
import historipol from "./fixtures/historipol.json" with { type: "json" };
import {
  EMPTY_CUSTOM_BLOCK_REGISTRY,
  RICH_TEXT_DOC_VERSION,
  buildCustomBlockRegistry,
  defaultCustomBlockData,
  defaultCustomBlockListEntry,
  hasBlockingIssues,
  parseCustomBlockDeclaration,
  validate,
  type BlockEnvelope,
  type CustomBlockRegistry,
  type Site,
} from "../src/index.js";
import { PARTNERS_DECLARATION } from "./fixtures/partners-declaration.js";

function decl(raw: unknown) {
  const result = parseCustomBlockDeclaration(raw);
  if (!result.ok) throw new Error(result.message);
  return result.declaration;
}

const declaration = decl(PARTNERS_DECLARATION);

const registry: CustomBlockRegistry = buildCustomBlockRegistry([
  { packageId: "org.example.practice", packageVersion: "1.2.0", declarations: [declaration] },
]);

const IMAGE = {
  hash: "abc",
  path: "assets/abc.png",
  metadataPath: "assets/abc.json",
  mime: "image/png",
  width: 10,
  height: 10,
  alt: "Alpha logo",
};

function siteWith(block: BlockEnvelope): Site {
  const site = structuredClone(historipol) as unknown as Site;
  site.pages[0]!.id = "page_home";
  site.pages[0]!.blocks.push(block);
  return site;
}

function partners(data: Record<string, unknown>, version = 1): BlockEnvelope {
  return { id: "blk_partners", type: "org.example/partners", version, data };
}

function codes(site: Site, options = { customBlocks: registry }): string[] {
  const result = validate(site, options);
  return [...result.errors, ...result.warnings].map((i) => i.code);
}

describe("validate() — unavailable Custom Blocks", () => {
  test("a Block whose package is missing is a blocking error at the Block, content untouched", () => {
    const site = siteWith(partners({ heading: "Keep me" }));
    const result = validate(site, { customBlocks: EMPTY_CUSTOM_BLOCK_REGISTRY });
    const issue = result.errors.find((i) => i.code === "block.custom.unavailable.package-missing");
    expect(issue).toBeDefined();
    expect(issue?.blocking).toBe(true);
    expect(issue?.path).toEqual(["pages", 0, "blocks", site.pages[0]!.blocks.length - 1, "data"]);
    expect(hasBlockingIssues(result)).toBe(true);
    expect((site.pages[0]!.blocks.at(-1)!.data as { heading: string }).heading).toBe("Keep me");
  });

  test("without a registry a Custom Block is an unknown type: envelope only, no error", () => {
    const site = siteWith(partners({ heading: "x" }));
    expect(validate(site).ok).toBe(true);
  });

  test("a package that needs a newer builder reports that reason", () => {
    const future = buildCustomBlockRegistry(
      [],
      [
        {
          packageId: "org.example.future",
          errorCode: "format-version-unsupported",
          message: "format 2",
          declaredTypes: ["org.example/partners"],
        },
      ],
    );
    const site = siteWith(partners({}));
    expect(codes(site, { customBlocks: future })).toContain(
      "block.custom.unavailable.needs-newer-builder",
    );
  });

  test("data saved by a newer package is unavailable", () => {
    const site = siteWith(partners({ heading: "x" }, 9));
    const result = validate(site, { customBlocks: registry });
    expect(result.errors.map((i) => i.code)).toContain("block.custom.unavailable.data-newer");
  });

  test("inside a Draft Article the same finding is an ordinary error", () => {
    const site = structuredClone(historipol) as unknown as Site;
    site.articles = [
      {
        id: "art_1",
        lang: site.defaultLanguage,
        slug: "hello",
        title: "Hello",
        state: "draft",
        publishedAt: "2026-01-01",
        blocks: [partners({})],
      } as unknown as Site["articles"] extends (infer A)[] | undefined ? A : never,
    ];
    const result = validate(site, { customBlocks: EMPTY_CUSTOM_BLOCK_REGISTRY });
    const issue = result.errors.find((i) => i.code === "block.custom.unavailable.package-missing");
    expect(issue).toBeDefined();
    expect(issue?.blocking).toBeUndefined();
    expect(hasBlockingIssues(result)).toBe(false);
  });
});

describe("validate() — content rules are warnings", () => {
  test("a clean Block produces no findings", () => {
    const data = {
      ...defaultCustomBlockData(declaration),
      heading: "Our partners",
      groups: [
        {
          heading: "Gold",
          partners: [{ name: "Alpha", image: IMAGE, link: { kind: "page", pageId: "page_home" } }],
        },
      ],
    };
    const result = validate(siteWith(partners(data)), { customBlocks: registry });
    expect(result.errors.filter((i) => i.code.startsWith("block.custom"))).toEqual([]);
    expect(result.warnings.filter((i) => i.code.startsWith("block.custom"))).toEqual([]);
  });

  test("required, maxLength, range, list size and unknown choice", () => {
    const data = {
      heading: "x".repeat(81),
      layout: "gone",
      count: 42,
      groups: [
        { heading: "", partners: [] },
        { heading: "b", partners: [{ name: "" }] },
        { heading: "c", partners: [] },
        { heading: "d", partners: [] },
        { heading: "e", partners: [] },
        { heading: "f", partners: [] },
      ],
    };
    const site = siteWith(partners(data));
    const result = validate(site, { customBlocks: registry });
    expect(result.errors.filter((i) => i.code.startsWith("block.custom"))).toEqual([]);
    const found = result.warnings.map((i) => [i.code, i.path.slice(4).join(".")]);
    expect(found).toContainEqual(["block.custom.field.maxLength", "data.heading"]);
    expect(found).toContainEqual(["block.custom.choice.unknown", "data.layout"]);
    expect(found).toContainEqual(["block.custom.field.range", "data.count"]);
    expect(found).toContainEqual(["block.custom.list.size", "data.groups"]);
    expect(found).toContainEqual(["block.custom.field.required", "data.groups.0.heading"]);
    expect(found).toContainEqual(["block.custom.field.required", "data.groups.1.partners.0.name"]);
    // Nothing was truncated or removed.
    const saved = site.pages[0]!.blocks.at(-1)!.data as { heading: string; groups: unknown[] };
    expect(saved.heading.length).toBe(81);
    expect(saved.groups.length).toBe(6);
  });

  test("a value of the wrong shape is a warning and is kept as saved", () => {
    const site = siteWith(partners({ heading: 12, groups: "not a list" }));
    const found = codes(site);
    expect(found.filter((c) => c === "block.custom.field.shape")).toHaveLength(2);
    expect(validate(site, { customBlocks: registry }).errors).toEqual([]);
  });

  test("a link to a missing Page is a warning: it renders as unlinked text", () => {
    const site = siteWith(
      partners({
        heading: "x",
        groups: [
          { heading: "g", partners: [{ name: "A", link: { kind: "page", pageId: "gone" } }] },
        ],
      }),
    );
    const result = validate(site, { customBlocks: registry });
    const issue = result.warnings.find((i) => i.code === "block.custom.link.missing");
    expect(issue).toBeDefined();
    expect(issue?.path.slice(4)).toEqual(["data", "groups", 0, "partners", 0, "link"]);
  });

  test("a link to a Draft Article warns as draft; a Published one is fine", () => {
    const site = siteWith(
      partners({
        heading: "x",
        groups: [
          { heading: "g", partners: [{ name: "A", link: { kind: "article", articleId: "a1" } }] },
        ],
      }),
    );
    site.articles = [
      {
        id: "a1",
        lang: site.defaultLanguage,
        slug: "a",
        title: "A",
        state: "draft",
        publishedAt: "2026-01-01",
        blocks: [],
      } as unknown as NonNullable<Site["articles"]>[number],
    ];
    expect(codes(site)).toContain("block.custom.link.draft");
    site.articles[0]!.state = "published";
    expect(codes(site)).not.toContain("block.custom.link.draft");
  });

  test("a web address that is not typed yet is no link; one the site cannot link to warns", () => {
    const required = decl({
      ...PARTNERS_DECLARATION,
      fields: [{ name: "link", kind: "link", label: "Link", required: true }],
    });
    const strict = buildCustomBlockRegistry([
      { packageId: "org.example.practice", packageVersion: "1.2.0", declarations: [required] },
    ]);
    const blank = siteWith(partners({ link: { kind: "external", href: "" } }));
    expect(codes(blank, { customBlocks: strict })).toContain("block.custom.field.required");
    const bad = siteWith(partners({ link: { kind: "external", href: "javascript:alert(1)" } }));
    const result = validate(bad, { customBlocks: strict });
    const issue = result.warnings.find((i) => i.code === "block.custom.link.invalid");
    expect(issue?.path.slice(4)).toEqual(["data", "link"]);
    expect(result.errors).toEqual([]);
    const good = siteWith(partners({ link: { kind: "external", href: "https://example.org" } }));
    expect(
      codes(good, { customBlocks: strict }).filter((code) => code.startsWith("block.custom")),
    ).toEqual([]);
  });

  test("an image without a description warns; missing bytes block", () => {
    const site = siteWith(
      partners({
        heading: "x",
        groups: [{ heading: "g", partners: [{ name: "A", image: { ...IMAGE, alt: "" } }] }],
      }),
    );
    const result = validate(site, { customBlocks: registry, assetPathExists: () => false });
    expect(result.warnings.map((i) => i.code)).toContain("block.custom.image.alt.missing");
    const missing = result.errors.find((i) => i.code === "block.custom.image.bytes.missing");
    expect(missing?.blocking).toBe(true);
    const present = validate(site, { customBlocks: registry, assetPathExists: () => true });
    expect(present.errors).toEqual([]);
  });

  test("rich-text fields reuse the Rich-text rules, rebased onto the field", () => {
    const site = siteWith(
      partners({
        heading: "x",
        intro: {
          version: RICH_TEXT_DOC_VERSION,
          content: [{ type: "hologram", content: [] }],
        },
      }),
    );
    const result = validate(site, { customBlocks: registry });
    const issue = result.errors.find((i) => i.code === "block.custom.richText.content.unsupported");
    expect(issue).toBeDefined();
    expect(issue?.blocking).toBe(true);
    expect(issue?.path.slice(4, 6)).toEqual(["data", "intro"]);
  });

  test("an optional rich-text field the author cleared is simply empty", () => {
    const site = siteWith(
      partners({ heading: "x", intro: { version: RICH_TEXT_DOC_VERSION, content: [] } }),
    );
    expect(codes(site).filter((code) => code.startsWith("block.custom.richText"))).toEqual([]);
  });

  test("an older data version warns and stays editable", () => {
    const registryV2 = buildCustomBlockRegistry([
      {
        packageId: "org.example.practice",
        packageVersion: "2.0.0",
        declarations: [{ ...declaration, version: 2 }],
      },
    ]);
    const site = siteWith(partners({ heading: "x" }, 1));
    const result = validate(site, { customBlocks: registryV2 });
    expect(result.errors).toEqual([]);
    expect(result.warnings.map((i) => i.code)).toContain("block.custom.version.outdated");
  });
});

describe("defaults", () => {
  test("a new Block starts empty except switches and choices", () => {
    expect(defaultCustomBlockData(declaration)).toEqual({ showHeadings: true, layout: "tight" });
  });

  test("a new list entry is empty with clear labels, nested lists start empty", () => {
    expect(defaultCustomBlockListEntry(declaration, ["groups"])).toEqual({});
    expect(defaultCustomBlockListEntry(declaration, ["groups", 0, "partners"])).toEqual({});
    expect(defaultCustomBlockListEntry(declaration, ["heading"])).toEqual({});
  });
});
