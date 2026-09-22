import { describe, expect, test } from "vitest";
import {
  RICH_TEXT_BLOCK_VERSION,
  RichTextDocumentSchema,
  SiteSchema,
  migrateBlock,
  migrateSite,
  validate,
} from "../src/index.js";

/**
 * richText v1 → v2 at the schema level (ADR 0048).
 *
 * The byte-exact HTML parity claim lives in
 * `packages/renderer/test/markdown-migration-golden.test.ts`, because it
 * needs both serialisers. What is pinned here is the *shape* of what the
 * migration writes and where it looks: every converted document must be a
 * document the schema accepts, every Block container on the Site must be
 * walked, and running the migration twice must change nothing.
 */

function legacyBlock(id: string, markdown: string, extra: Record<string, unknown> = {}) {
  return { id, type: "richText", version: 1, data: { markdown, ...extra } };
}

function siteWith(pageBlocks: unknown[], articleBlocks?: unknown[]): Record<string, unknown> {
  const site: Record<string, unknown> = {
    schemaVersion: 1,
    org: { name: "Org", email: "a@b.ro" },
    theme: { id: "stub" },
    defaultLanguage: "ro",
    languages: ["ro"],
    pages: [
      {
        slug: "acasa",
        lang: "ro",
        navLabel: "Acasă",
        navOrder: 0,
        showInNav: true,
        blocks: pageBlocks,
      },
    ],
  };
  if (articleBlocks !== undefined) {
    site["articles"] = [
      {
        id: "art_1",
        lang: "ro",
        slug: "primul",
        title: "Primul",
        publishedAt: "2026-09-01",
        state: "published",
        blocks: articleBlocks,
      },
    ];
  }
  return site;
}

describe("richText v1 → v2 migration", () => {
  test("converts the Markdown string into a document the schema accepts", () => {
    const result = migrateBlock(
      legacyBlock("b1", "## Salut\n\nText **gros** și [link](https://x.ro)."),
    );
    expect(result.appliedVersions).toEqual([RICH_TEXT_BLOCK_VERSION]);
    const block = result.block as { version: number; data: Record<string, unknown> };
    expect(block.version).toBe(RICH_TEXT_BLOCK_VERSION);
    expect(block.data["markdown"]).toBeUndefined();
    expect(RichTextDocumentSchema.safeParse(block.data["doc"]).success).toBe(true);
  });

  test("keeps the Block-level alignment and unknown sibling keys untouched", () => {
    // ADR 0002's preserve-unknown contract does not pause for a migration:
    // only `markdown` is consumed.
    const result = migrateBlock(
      legacyBlock("b1", "Text.", { titleAlign: "center", paragraphAlign: "justify", future: 1 }),
    );
    const data = (result.block as { data: Record<string, unknown> }).data;
    expect(data["titleAlign"]).toBe("center");
    expect(data["paragraphAlign"]).toBe("justify");
    expect(data["future"]).toBe(1);
  });

  test("walks Article bodies as well as Pages", () => {
    const result = migrateSite(
      siteWith([legacyBlock("p1", "Pe pagină.")], [legacyBlock("a1", "În articol.")]),
    );
    expect(result.blockMigrations.map((entry) => entry.path)).toEqual([
      ["pages", 0, "blocks", 0],
      ["articles", 0, "blocks", 0],
    ]);
    const parsed = SiteSchema.safeParse(result.data);
    expect(parsed.success).toBe(true);
    expect(validate(result.data).errors).toEqual([]);
  });

  test("a migrated Site is a fixed point: a second pass changes nothing", () => {
    const once = migrateSite(
      siteWith([legacyBlock("p1", "- unu\n- doi")], [legacyBlock("a1", "> citat")]),
    );
    const twice = migrateSite(once.data);
    expect(twice.blockMigrations).toEqual([]);
    expect(twice.data).toEqual(once.data);
    // And the untouched object is returned as-is, so callers can cheaply
    // detect "nothing happened" by identity.
    expect(twice.data).toBe(once.data);
  });

  test("a Site with no legacy Blocks comes back untouched, by identity", () => {
    const current = siteWith([
      {
        id: "p1",
        type: "richText",
        version: 2,
        data: { doc: { version: 1, content: [] } },
      },
    ]);
    const result = migrateSite(current);
    expect(result.blockMigrations).toEqual([]);
    expect(result.data).toBe(current);
  });
});
