import { describe, expect, test } from "vitest";

import { MemoryDriver, ZipDriver } from "@sosb/vfs";

import historipol from "./fixtures/historipol.json" with { type: "json" };
import { exportToZip, importFromZip } from "../src/index.js";

const enc = new TextEncoder();

async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

function bytes(s: string): Uint8Array {
  return enc.encode(s);
}

describe("exportToZip", () => {
  test("produces a Blob containing data.json, DEPLOY.md, built dist/, and any asset bytes", async () => {
    const assets = new MemoryDriver();
    await assets.write("assets/8e3a7f.png", new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
    await assets.write("assets/4a91d2.jpg", new Uint8Array([0xff, 0xd8, 0xff, 0xe0]));

    const blob = await exportToZip(historipol, assets);
    expect(blob).toBeInstanceOf(Blob);

    // Reload via ZipDriver to inspect contents.
    const inspector = ZipDriver.fromZipBytes(await blobToBytes(blob));
    const paths = await inspector.list();
    expect(paths).toContain("data.json");
    expect(paths).toContain("DEPLOY.md");
    expect(paths).toContain("dist/index.html");
    expect(paths).toContain("dist/robots.txt");
    expect(paths).toContain("dist/sitemap.xml");
    expect(paths).toContain("dist/_lighthouse-budget.json");
    expect(paths).not.toContain("dist/.gitkeep");
    expect(paths).toContain("assets/8e3a7f.png");
    expect(paths).toContain("assets/4a91d2.jpg");
    expect(paths).toContain("dist/assets/8e3a7f.png");
    expect(paths).toContain("dist/assets/4a91d2.jpg");
    expect(paths).toContain("dist/despre/assets/8e3a7f.png");
    expect(paths).toContain("dist/despre/assets/4a91d2.jpg");
  });

  test("ships self-hosted theme fonts as binary woff2 under dist/assets/fonts/ (PR-F2b)", async () => {
    // The historipol fixture uses the `academic` theme whose body font
    // (`Inter`) is a self-hosted registered family, so `build()` injects its
    // woff2 bytes and the zip carries them as real binary.
    const blob = await exportToZip(historipol, new MemoryDriver());
    const inspector = ZipDriver.fromZipBytes(await blobToBytes(blob));
    const paths = await inspector.list();
    const fontPaths = paths.filter(
      (p) => p.startsWith("dist/assets/fonts/") && p.endsWith(".woff2"),
    );
    expect(fontPaths.length).toBeGreaterThan(0);

    for (const p of fontPaths) {
      const back = await inspector.read(p);
      // woff2 signature: first 4 bytes spell 'wOF2'.
      expect(Array.from(back.subarray(0, 4))).toEqual([0x77, 0x4f, 0x46, 0x32]);
    }
  });

  test("mirrors build-owned dist assets for nested page-relative URLs", async () => {
    const blob = await exportToZip(historipol, new MemoryDriver());
    const inspector = ZipDriver.fromZipBytes(await blobToBytes(blob));
    const paths = await inspector.list();
    const rootFont = paths.find((p) => p.startsWith("dist/assets/fonts/") && p.endsWith(".woff2"));
    expect(rootFont).toBeDefined();

    const nestedFont = rootFont!.replace("dist/assets/", "dist/despre/assets/");
    expect(paths).toContain(nestedFont);
    expect(Array.from(await inspector.read(nestedFont))).toEqual(
      Array.from(await inspector.read(rootFont!)),
    );
  });

  test("dist/index.html is the rendered static site, not a placeholder", async () => {
    const blob = await exportToZip(historipol, new MemoryDriver());
    const inspector = ZipDriver.fromZipBytes(await blobToBytes(blob));
    const html = new TextDecoder().decode(await inspector.read("dist/index.html"));
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("HISTORIPOL");
  });

  test("DEPLOY.md uses the generated Cloudflare guide in the site's language", async () => {
    const blob = await exportToZip(historipol, new MemoryDriver());
    const inspector = ZipDriver.fromZipBytes(await blobToBytes(blob));
    const deployMd = new TextDecoder().decode(await inspector.read("DEPLOY.md"));
    expect(deployMd).toContain("Asociația Studențească HISTORIPOL");
    expect(deployMd).toMatch(/încărcare directă/i);
    expect(deployMd).toMatch(/Cloudflare Pages/);
    expect(deployMd).not.toMatch(/placeholder/i);
  });

  test("data.json in the zip equals JSON.stringify(siteData) (with stable formatting)", async () => {
    const blob = await exportToZip(historipol, new MemoryDriver());
    const inspector = ZipDriver.fromZipBytes(await blobToBytes(blob));
    const dataJsonBytes = await inspector.read("data.json");
    const dataJsonText = new TextDecoder().decode(dataJsonBytes);
    const parsed = JSON.parse(dataJsonText);
    expect(parsed).toEqual(historipol);
  });

  test("assets are written under assets/ exactly as the input VFS held them", async () => {
    const assets = new MemoryDriver();
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    await assets.write("assets/8e3a7f.png", png);

    const blob = await exportToZip(historipol, assets);
    const inspector = ZipDriver.fromZipBytes(await blobToBytes(blob));
    const back = await inspector.read("assets/8e3a7f.png");
    expect(Array.from(back)).toEqual(Array.from(png));
  });

  test("ignores VFS entries outside the assets/ prefix (only assets are bundled)", async () => {
    const assets = new MemoryDriver();
    await assets.write("assets/8e3a7f.png", bytes("png"));
    // A stray non-asset entry in the input VFS should not leak into the zip.
    await assets.write("scratch/note.txt", bytes("ignore me"));

    const blob = await exportToZip(historipol, assets);
    const inspector = ZipDriver.fromZipBytes(await blobToBytes(blob));
    const paths = await inspector.list();
    expect(paths).not.toContain("scratch/note.txt");
    expect(paths).toContain("assets/8e3a7f.png");
  });

  test("export is deterministic — same input produces byte-identical zip across calls", async () => {
    const a = await exportToZip(historipol, new MemoryDriver());
    const b = await exportToZip(historipol, new MemoryDriver());
    expect(Array.from(await blobToBytes(b))).toEqual(Array.from(await blobToBytes(a)));
  });
});

describe("importFromZip", () => {
  test("reads back the siteData it was exported with", async () => {
    const blob = await exportToZip(historipol, new MemoryDriver());
    const { siteData } = await importFromZip(blob);
    expect(siteData).toEqual(historipol);
  });

  test("reads back the asset bytes", async () => {
    const assets = new MemoryDriver();
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    await assets.write("assets/8e3a7f.png", png);

    const blob = await exportToZip(historipol, assets);
    const { vfs } = await importFromZip(blob);
    const back = await vfs.read("assets/8e3a7f.png");
    expect(Array.from(back)).toEqual(Array.from(png));
  });

  test("vfs returned only contains assets/ paths (data.json, DEPLOY.md, dist/ are not surfaced)", async () => {
    const assets = new MemoryDriver();
    await assets.write("assets/a.png", bytes("a"));
    await assets.write("assets/b.png", bytes("b"));

    const blob = await exportToZip(historipol, assets);
    const { vfs } = await importFromZip(blob);
    const paths = await vfs.list();
    expect(paths).toEqual(["assets/a.png", "assets/b.png"]);
  });
});

describe("round-trip identity", () => {
  test("import → export → import yields a byte-identical zip", async () => {
    const assets = new MemoryDriver();
    await assets.write("assets/8e3a7f.png", new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
    await assets.write("assets/4a91d2.jpg", new Uint8Array([0xff, 0xd8, 0xff, 0xe0]));

    const firstBlob = await exportToZip(historipol, assets);
    const { siteData, vfs } = await importFromZip(firstBlob);
    const secondBlob = await exportToZip(siteData, vfs);

    expect(Array.from(await blobToBytes(secondBlob))).toEqual(
      Array.from(await blobToBytes(firstBlob)),
    );
  });

  test("import → export → import yields an equal siteData", async () => {
    const blob = await exportToZip(historipol, new MemoryDriver());
    const round1 = await importFromZip(blob);
    const round2 = await importFromZip(await exportToZip(round1.siteData, round1.vfs));
    expect(round2.siteData).toEqual(historipol);
  });

  test("HISTORIPOL fixture survives a full read-write-read cycle unchanged", async () => {
    const assets = new MemoryDriver();
    await assets.write("assets/8e3a7f.png", bytes("png-bytes"));
    await assets.write("assets/4a91d2.jpg", bytes("jpg-bytes"));

    const blob = await exportToZip(historipol, assets);
    const after = await importFromZip(blob);

    expect(after.siteData).toEqual(historipol);
    expect(await after.vfs.list()).toEqual(["assets/4a91d2.jpg", "assets/8e3a7f.png"]);
  });

  test("round-trip with a randomised fixture: unknown block + unknown field preserved", async () => {
    const augmented = structuredClone(historipol) as unknown as {
      pages: { blocks: unknown[] }[];
      futureRootField: { kind: string; value: number };
      org: Record<string, unknown>;
      theme: { tokens: Record<string, unknown> };
    };
    augmented.pages[0]!.blocks.push({
      id: "blk_unknown_future",
      type: "futureBlockType",
      version: 7,
      data: {
        deeplyNested: { array: [1, 2, 3], obj: { a: "b" } },
        diacritics: "Universitatea „Ovidius” Constanța",
      },
    });
    augmented.futureRootField = { kind: "experimental", value: 42 };
    augmented.org.experimentalCustomField = "preserved";
    augmented.theme.tokens.shadowDepth = "soft";

    const blob = await exportToZip(augmented, new MemoryDriver());
    const round1 = await importFromZip(blob);
    expect(round1.siteData).toEqual(augmented);

    const blob2 = await exportToZip(round1.siteData, round1.vfs);
    const round2 = await importFromZip(blob2);
    expect(round2.siteData).toEqual(augmented);

    expect(Array.from(await blobToBytes(blob2))).toEqual(Array.from(await blobToBytes(blob)));
  });
});
