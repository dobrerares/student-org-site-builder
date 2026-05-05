import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import { renderSite } from "../src/index.js";

/**
 * Site fixture builder for documentDownloads renderer tests. Builds a
 * minimal site with a hero (every page needs one) and a single
 * documentDownloads block of the requested shape.
 */
function siteWithDownloads(data: Record<string, unknown>, blockId = "blk_docs"): Site {
  return {
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
        seo: { title: "Documente — Test Org" },
        blocks: [
          {
            id: "blk_hero",
            type: "hero",
            version: 1,
            data: { title: "Documente publice" },
          },
          { id: blockId, type: "documentDownloads", version: 1, data },
        ],
      },
    ],
  } as unknown as Site;
}

const onePdfFile = {
  asset: {
    hash: "8e3a7f9b1c0d2e4f",
    path: "assets/8e3a7f9b1c0d2e4f.pdf",
    metadataPath: "assets/8e3a7f9b1c0d2e4f.metadata.json",
    mime: "application/pdf",
    byteSize: 184_320, // 180 KiB
  },
  label: "Regulament intern",
  description: "Regulamentul anual al organizației.",
};

describe("documentDownloads block — list layout (default)", () => {
  test("renders a section element with data-block='documentDownloads'", () => {
    const html = renderSite(siteWithDownloads({ files: [structuredClone(onePdfFile)] }), "stub");
    expect(html).toMatch(/<section[^>]*data-block="documentDownloads"/);
  });

  test("uses the list layout when no layout is specified", () => {
    const html = renderSite(siteWithDownloads({ files: [structuredClone(onePdfFile)] }), "stub");
    expect(html).toMatch(/<section[^>]*data-block="documentDownloads"[^>]*data-layout="list"/);
  });

  test("renders the file label as the link text", () => {
    const html = renderSite(siteWithDownloads({ files: [structuredClone(onePdfFile)] }), "stub");
    // The link text should be the human-readable label, not the path.
    expect(html).toContain("Regulament intern");
  });

  test("links to the asset's VFS path with a download attribute", () => {
    const html = renderSite(siteWithDownloads({ files: [structuredClone(onePdfFile)] }), "stub");
    expect(html).toMatch(/<a[^>]*href="assets\/8e3a7f9b1c0d2e4f\.pdf"[^>]*download/);
  });

  test("renders an aria-label that includes the file type and human-readable size", () => {
    const html = renderSite(siteWithDownloads({ files: [structuredClone(onePdfFile)] }), "stub");
    // 184_320 bytes ≈ 180 KB / KiB. The aria-label must reference both
    // the type (PDF) and the size (KB) so screen-reader users hear
    // "Regulament intern, PDF, 180 KB" or similar.
    const ariaLabelMatch = /aria-label="([^"]+)"/.exec(html);
    expect(ariaLabelMatch).not.toBeNull();
    const aria = ariaLabelMatch![1] ?? "";
    expect(aria).toMatch(/PDF/i);
    expect(aria).toMatch(/KB|KiB/);
  });

  test("renders the description when present", () => {
    const html = renderSite(siteWithDownloads({ files: [structuredClone(onePdfFile)] }), "stub");
    expect(html).toContain("Regulamentul anual al organizației.");
  });

  test("omits the description when not provided", () => {
    const noDesc = { ...structuredClone(onePdfFile), description: undefined };
    delete (noDesc as Record<string, unknown>).description;
    const html = renderSite(siteWithDownloads({ files: [noDesc] }), "stub");
    expect(html).toContain("Regulament intern");
    // No paragraph for description on this entry.
    expect(html).not.toContain("Regulamentul anual al organizației.");
  });

  test("renders a visible size + type indicator (data-attribute or text)", () => {
    const html = renderSite(siteWithDownloads({ files: [structuredClone(onePdfFile)] }), "stub");
    // Visible text mentions both size and type so sighted users see what they're downloading.
    expect(html).toMatch(/180\s*K(B|iB)/);
    expect(html).toMatch(/\bPDF\b/);
  });

  test("renders multiple files as a list (one <li> per file)", () => {
    const second = {
      ...structuredClone(onePdfFile),
      asset: {
        hash: "1234abcd5678ef90",
        path: "assets/1234abcd5678ef90.docx",
        metadataPath: "assets/1234abcd5678ef90.metadata.json",
        mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        byteSize: 25_600,
      },
      label: "Statut",
      description: undefined,
    };
    delete (second as Record<string, unknown>).description;
    const html = renderSite(
      siteWithDownloads({ files: [structuredClone(onePdfFile), second] }),
      "stub",
    );
    const matches = html.match(/<li[^>]*class="document-downloads__item/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(2);
  });
});

describe("documentDownloads block — cards layout", () => {
  test("emits data-layout='cards' when layout is set to cards", () => {
    const html = renderSite(
      siteWithDownloads({
        layout: "cards",
        files: [structuredClone(onePdfFile)],
      }),
      "stub",
    );
    expect(html).toMatch(/<section[^>]*data-block="documentDownloads"[^>]*data-layout="cards"/);
  });

  test("still renders an anchor list with download attributes regardless of layout", () => {
    const html = renderSite(
      siteWithDownloads({
        layout: "cards",
        files: [structuredClone(onePdfFile)],
      }),
      "stub",
    );
    expect(html).toMatch(/<a[^>]*href="assets\/8e3a7f9b1c0d2e4f\.pdf"[^>]*download/);
  });
});

describe("documentDownloads block — title + intro", () => {
  test("renders the optional title as a heading", () => {
    const html = renderSite(
      siteWithDownloads({
        title: "Documente publice",
        files: [structuredClone(onePdfFile)],
      }),
      "stub",
    );
    expect(html).toMatch(/<h2[^>]*>[\s\S]*Documente publice[\s\S]*<\/h2>/);
  });

  test("renders the optional intro as a paragraph above the list", () => {
    const html = renderSite(
      siteWithDownloads({
        intro: "Materialele oficiale ale organizației.",
        files: [structuredClone(onePdfFile)],
      }),
      "stub",
    );
    expect(html).toContain("Materialele oficiale ale organizației.");
  });

  test("omits the heading when no title is provided", () => {
    const html = renderSite(siteWithDownloads({ files: [structuredClone(onePdfFile)] }), "stub");
    // No h2 inside the documentDownloads section.
    const sectionMatch = /<section[^>]*data-block="documentDownloads"[\s\S]*?<\/section>/.exec(
      html,
    );
    expect(sectionMatch).not.toBeNull();
    expect(sectionMatch![0]).not.toContain("<h2");
  });
});

describe("documentDownloads block — file size formatting", () => {
  test("formats bytes under 1 KiB as 'B'", () => {
    const tiny = {
      ...structuredClone(onePdfFile),
      asset: { ...structuredClone(onePdfFile.asset), byteSize: 512 },
    };
    const html = renderSite(siteWithDownloads({ files: [tiny] }), "stub");
    expect(html).toMatch(/512\s*B\b/);
  });

  test("formats kilobyte ranges as 'KB'", () => {
    // 184_320 ≈ 180 KB.
    const html = renderSite(siteWithDownloads({ files: [structuredClone(onePdfFile)] }), "stub");
    expect(html).toMatch(/180\s*KB/);
  });

  test("formats megabyte ranges as 'MB'", () => {
    const big = {
      ...structuredClone(onePdfFile),
      asset: {
        ...structuredClone(onePdfFile.asset),
        byteSize: 5 * 1024 * 1024 + 250 * 1024, // 5.2 MB-ish
      },
    };
    const html = renderSite(siteWithDownloads({ files: [big] }), "stub");
    expect(html).toMatch(/5\.[0-9]\s*MB/);
  });
});

describe("documentDownloads block — file type labels", () => {
  test.each([
    ["application/pdf", "PDF"],
    ["application/msword", "DOC"],
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "DOCX"],
    ["application/vnd.ms-excel", "XLS"],
    ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "XLSX"],
    ["application/vnd.ms-powerpoint", "PPT"],
    ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "PPTX"],
    ["application/zip", "ZIP"],
    ["text/plain", "TXT"],
    ["text/csv", "CSV"],
    ["application/vnd.oasis.opendocument.text", "ODT"],
    ["application/vnd.oasis.opendocument.spreadsheet", "ODS"],
  ])("renders %s as the visible type label '%s'", (mime, expectedLabel) => {
    const file = {
      ...structuredClone(onePdfFile),
      asset: {
        ...structuredClone(onePdfFile.asset),
        mime,
        path: `assets/abcdef1234567890.${expectedLabel.toLowerCase()}`,
      },
    };
    const html = renderSite(siteWithDownloads({ files: [file] }), "stub");
    // Visible label appears somewhere inside the block's section.
    const section = /<section[^>]*data-block="documentDownloads"[\s\S]*?<\/section>/.exec(html);
    expect(section).not.toBeNull();
    expect(section![0]).toMatch(new RegExp(`\\b${expectedLabel}\\b`));
  });
});

describe("documentDownloads block — forward-compat", () => {
  test("ignores unknown extra fields on a file (does not throw)", () => {
    const file = {
      ...structuredClone(onePdfFile),
      futureField: "ignored",
    };
    const html = renderSite(siteWithDownloads({ files: [file] }), "stub");
    expect(html).toContain("Regulament intern");
  });

  test("falls back gracefully when an unknown layout is specified", () => {
    const html = renderSite(
      siteWithDownloads({ layout: "carousel", files: [structuredClone(onePdfFile)] }),
      "stub",
    );
    // The renderer accepts unknown layout strings (envelope is loose) and
    // falls back to list. The block must still render.
    expect(html).toContain("Regulament intern");
    expect(html).toMatch(/<section[^>]*data-block="documentDownloads"/);
  });
});
