import { describe, expect, test } from "vitest";
import { MemoryDriver, ZipDriver } from "@sosb/vfs";
import type { Site } from "@sosb/schema";

import articlesFixture from "./fixtures/articles.json" with { type: "json" };
import { draftOnlyAssetPaths, exportToZip, importFromZip } from "../src/index.js";

async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

function assetRef(hash: string): Record<string, unknown> {
  return {
    hash,
    path: `assets/${hash}.webp`,
    metadataPath: `assets/${hash}.json`,
    mime: "image/webp",
    width: 800,
    height: 450,
    alt: "Cover",
  };
}

/**
 * A site where one image is used only by a Draft article, one only by a
 * Published article, and one by both a Draft and a Page.
 */
function siteWithCovers(): Site {
  const site = structuredClone(articlesFixture) as unknown as Site;
  const articles = site.articles ?? [];
  const draft = articles.find((a) => a.id === "art_ro_schita")!;
  const published = articles.find((a) => a.id === "art_ro_gala")!;

  draft.cover = assetRef("draftonly") as never;
  draft.coverAlt = "Draft cover";
  published.cover = assetRef("published") as never;
  published.coverAlt = "Published cover";

  // A third image referenced by BOTH the draft article and public content
  // (the org logo), which must therefore survive into `dist/`.
  draft.blocks = [
    {
      id: "blk_draft_hero",
      type: "hero",
      version: 1,
      data: { title: "Schiță", backgroundImage: assetRef("shared"), backgroundAlt: "Shared" },
    } as never,
  ];
  site.org.logo = assetRef("shared") as never;
  site.org.logoAlt = "Shared";

  return site;
}

describe("draftOnlyAssetPaths", () => {
  const site = siteWithCovers();

  test("finds files used only by draft articles", () => {
    const paths = draftOnlyAssetPaths(site);
    expect(paths.has("assets/draftonly.webp")).toBe(true);
    expect(paths.has("assets/draftonly.json")).toBe(true);
  });

  test("keeps files a published article uses", () => {
    expect(draftOnlyAssetPaths(site).has("assets/published.webp")).toBe(false);
  });

  test("keeps files shared between a draft and public content", () => {
    expect(draftOnlyAssetPaths(site).has("assets/shared.webp")).toBe(false);
  });

  test("a site with no articles has no draft-only assets", () => {
    const noArticles = structuredClone(site);
    delete noArticles.articles;
    expect(draftOnlyAssetPaths(noArticles).size).toBe(0);
  });

  test("tolerates non-site input rather than throwing", () => {
    expect(draftOnlyAssetPaths(null).size).toBe(0);
    expect(draftOnlyAssetPaths("nonsense").size).toBe(0);
  });
});

describe("exportToZip with drafts", () => {
  test("the editable archive keeps draft-only files; dist/ does not", async () => {
    const site = siteWithCovers();
    const assets = new MemoryDriver();
    for (const hash of ["draftonly", "published", "shared"]) {
      await assets.write(`assets/${hash}.webp`, new Uint8Array([1, 2, 3]));
      await assets.write(`assets/${hash}.json`, new Uint8Array([4, 5]));
    }

    const inspector = ZipDriver.fromZipBytes(await blobToBytes(await exportToZip(site, assets)));
    const paths = await inspector.list();

    // Editable archive: everything, so the author never loses work.
    expect(paths).toContain("assets/draftonly.webp");
    expect(paths).toContain("assets/published.webp");
    expect(paths).toContain("assets/shared.webp");

    // Public output: no draft-only bytes, at any mirror depth.
    expect(paths.filter((p) => p.startsWith("dist/") && p.includes("draftonly"))).toEqual([]);
    expect(paths).toContain("dist/assets/published.webp");
    expect(paths).toContain("dist/assets/shared.webp");
  });

  test("draft article HTML never reaches dist/", async () => {
    const site = siteWithCovers();
    const inspector = ZipDriver.fromZipBytes(
      await blobToBytes(await exportToZip(site, new MemoryDriver())),
    );
    const paths = await inspector.list();
    expect(paths.filter((p) => p.includes("schita-nepublicata"))).toEqual([]);
    expect(paths).toContain("dist/articles/gala-de-final/index.html");
    expect(paths).toContain("dist/articles/raport-intern/index.html");
  });

  test("assets mirror into nested article folders for relative URLs", async () => {
    const assets = new MemoryDriver();
    await assets.write("assets/published.webp", new Uint8Array([1, 2, 3]));
    const site = siteWithCovers();
    const inspector = ZipDriver.fromZipBytes(await blobToBytes(await exportToZip(site, assets)));
    const paths = await inspector.list();
    expect(paths).toContain("dist/articles/gala-de-final/assets/published.webp");
    expect(paths).toContain("dist/en/articles/end-of-year-gala/assets/published.webp");
  });

  test("round-trips drafts, tags, and slug history through data.json unchanged", async () => {
    const site = siteWithCovers();
    const blob = await exportToZip(site, new MemoryDriver());
    const reimported = await importFromZip(blob);
    expect(reimported.siteData.articles).toEqual(site.articles);
    expect(reimported.siteData.tags).toEqual(site.tags);
  });

  test("export stays deterministic with articles present", async () => {
    const site = siteWithCovers();
    const a = await blobToBytes(await exportToZip(site, new MemoryDriver()));
    const b = await blobToBytes(await exportToZip(site, new MemoryDriver()));
    expect(a).toEqual(b);
  });
});
