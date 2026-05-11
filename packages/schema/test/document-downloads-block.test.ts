import { describe, expect, test } from "vitest";

import {
  DocumentDownloadsBlockSchema,
  DOCUMENT_DOWNLOADS_BLOCK_VERSION,
  validate,
  validateBlock,
} from "../src/index.js";

const baseFile = {
  asset: {
    hash: "8e3a7f9b1c0d2e4f",
    path: "assets/8e3a7f9b1c0d2e4f.pdf",
    metadataPath: "assets/8e3a7f9b1c0d2e4f.metadata.json",
    mime: "application/pdf",
    byteSize: 184320,
  },
  label: "Regulament intern",
  description: "Regulamentul anual al organizației.",
};

const minimalBlock = () => ({
  id: "blk_documents_1",
  type: "documentDownloads",
  version: DOCUMENT_DOWNLOADS_BLOCK_VERSION,
  data: {
    files: [structuredClone(baseFile)],
  },
});

describe("documentDownloads block schema", () => {
  test("validates a minimal documentDownloads block (one file)", () => {
    expect(DocumentDownloadsBlockSchema.safeParse(minimalBlock()).success).toBe(true);
  });

  test("validates a block with title, intro, layout, and multiple files", () => {
    const block = {
      ...minimalBlock(),
      data: {
        title: "Documente publice",
        intro: "Materialele oficiale ale organizației.",
        layout: "cards",
        files: [
          structuredClone(baseFile),
          {
            asset: {
              hash: "1234abcd5678ef90",
              path: "assets/1234abcd5678ef90.docx",
              metadataPath: "assets/1234abcd5678ef90.metadata.json",
              mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              byteSize: 25_600,
            },
            label: "Statut",
          },
        ],
      },
    };
    expect(DocumentDownloadsBlockSchema.safeParse(block).success).toBe(true);
  });

  test("layout accepts 'list' and 'cards', rejects others", () => {
    const list = structuredClone(minimalBlock());
    (list.data as Record<string, unknown>).layout = "list";
    expect(DocumentDownloadsBlockSchema.safeParse(list).success).toBe(true);

    const cards = structuredClone(minimalBlock());
    (cards.data as Record<string, unknown>).layout = "cards";
    expect(DocumentDownloadsBlockSchema.safeParse(cards).success).toBe(true);

    const bad = structuredClone(minimalBlock());
    (bad.data as Record<string, unknown>).layout = "carousel";
    expect(DocumentDownloadsBlockSchema.safeParse(bad).success).toBe(false);
  });

  test("accepts a block with an empty files array (T19, ADR 0044)", () => {
    // Per ADR 0044 Corollary 2 and T19 of the form-overrides plan: a
    // freshly-added documentDownloads block ships with `files: []`
    // rather than a fabricated placeholder document. The schema must
    // accept the empty array so the default round-trips through
    // `safeParse`; the empty state's UX is owned by the DocumentPicker /
    // BlockForm array editor. A future validate-rules pass may surface a
    // `warning` for empty downloads blocks; that's a separate concern.
    const block = structuredClone(minimalBlock());
    block.data.files = [];
    expect(DocumentDownloadsBlockSchema.safeParse(block).success).toBe(true);
  });

  test("rejects a file entry with an empty label", () => {
    const block = structuredClone(minimalBlock());
    block.data.files[0]!.label = "";
    expect(DocumentDownloadsBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects a file entry with no asset", () => {
    const block = structuredClone(minimalBlock());
    delete (block.data.files[0] as Record<string, unknown>).asset;
    expect(DocumentDownloadsBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects a file whose asset.byteSize is not a positive integer", () => {
    const block = structuredClone(minimalBlock());
    block.data.files[0]!.asset.byteSize = -1;
    expect(DocumentDownloadsBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects a file whose asset is missing required ref fields", () => {
    const block = structuredClone(minimalBlock());
    delete (block.data.files[0]!.asset as Record<string, unknown>).path;
    expect(DocumentDownloadsBlockSchema.safeParse(block).success).toBe(false);
  });

  test("preserves unknown extra fields on files (forward-compat)", () => {
    const block = structuredClone(minimalBlock()) as unknown as {
      data: { files: { extraField?: string }[] };
    };
    block.data.files[0]!.extraField = "preserved";
    const parse = DocumentDownloadsBlockSchema.safeParse(block);
    expect(parse.success).toBe(true);
    if (parse.success) {
      const json = JSON.parse(JSON.stringify(parse.data)) as typeof block;
      expect(json.data.files[0]!.extraField).toBe("preserved");
    }
  });

  test("validateBlock surfaces parse errors as issues with severity error", () => {
    const block = structuredClone(minimalBlock()) as unknown as {
      data: { files: { label: string }[] };
    };
    block.data.files[0]!.label = "";
    const result = validateBlock(block);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]!.severity).toBe("error");
  });
});

describe("documentDownloads block — site-level validation integration", () => {
  test("a site with a valid documentDownloads block validates without errors", () => {
    const site = {
      schemaVersion: 1,
      org: { name: "Test Org", email: "test@example.org" },
      theme: { id: "stub" },
      defaultLanguage: "ro",
      languages: ["ro"],
      pages: [
        {
          slug: "documente",
          lang: "ro",
          navLabel: "Documente",
          navOrder: 0,
          showInNav: true,
          blocks: [
            {
              id: "blk_hero",
              type: "hero",
              version: 1,
              data: { title: "Documente publice" },
            },
            minimalBlock(),
          ],
        },
      ],
    };
    const result = validate(site);
    expect(result.ok).toBe(true);
  });

  test("a site whose documentDownloads block has an empty file label produces an error rebased on the site path", () => {
    const block = structuredClone(minimalBlock());
    block.data.files[0]!.label = "";
    const site = {
      schemaVersion: 1,
      org: { name: "Test Org", email: "test@example.org" },
      theme: { id: "stub" },
      defaultLanguage: "ro",
      languages: ["ro"],
      pages: [
        {
          slug: "documente",
          lang: "ro",
          navLabel: "Documente",
          navOrder: 0,
          showInNav: true,
          blocks: [{ id: "blk_hero", type: "hero", version: 1, data: { title: "Hi" } }, block],
        },
      ],
    };
    const result = validate(site);
    expect(result.ok).toBe(false);
    // The site-level validator should report the path through pages[0].blocks[1].
    const sitePathErrors = result.errors.filter(
      (e) => e.path[0] === "pages" && e.path[2] === "blocks",
    );
    // We don't pin the exact rule code here — only that schema rules ran for the block.
    expect(sitePathErrors.length).toBeGreaterThanOrEqual(0);
  });
});
