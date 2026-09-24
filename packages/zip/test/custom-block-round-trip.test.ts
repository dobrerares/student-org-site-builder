/**
 * Unavailable Custom Blocks survive the editable archive (ADR 0055; issue-106
 * plan, "missing required extension" and "extension requires a newer
 * builder"): the Site opens and saves with the Block's data and files
 * intact, and the package recovery copy travels alongside `themes/`.
 *
 * The public export inside the archive is a different matter — `build()`
 * refuses a Custom Block no supplied package declares — so this file also
 * pins that an archive save with such a Block is refused loudly rather than
 * written with a hole in it.
 */
import { describe, expect, test } from "vitest";
import { MemoryDriver, ZipDriver } from "@sosb/vfs";
import { BuildCustomBlockMissingError } from "@sosb/build";
import type { Site } from "@sosb/schema";
import { EMPTY_CUSTOM_BLOCK_REGISTRY, hasBlockingIssues, validate } from "@sosb/schema";
import { readThemeRecoveryCopy } from "@sosb/theme-package";

import historipol from "./fixtures/historipol.json" with { type: "json" };
import { exportToZip, importFromZip } from "../src/index.js";

const enc = new TextEncoder();

const PARTNERS_BLOCK = {
  id: "blk_partners",
  type: "org.example/partners",
  version: 1,
  data: {
    heading: "Our partners",
    partners: [
      {
        name: "Alpha",
        image: {
          hash: "8e3a7f",
          path: "assets/8e3a7f.png",
          metadataPath: "assets/8e3a7f.json",
          mime: "image/png",
          width: 1,
          height: 1,
          alt: "Alpha logo",
        },
        link: { kind: "page", pageId: "page_home" },
      },
    ],
    futureKey: { kept: true },
  },
};

function siteWithBlock(): Site {
  const site = structuredClone(historipol) as unknown as Site;
  site.pages[0]!.id = "page_home";
  site.pages[0]!.blocks.push(structuredClone(PARTNERS_BLOCK));
  return site;
}

/** A VFS with the Block's image and a recovery copy left by an earlier update. */
async function siteVfs(): Promise<MemoryDriver> {
  const vfs = new MemoryDriver();
  await vfs.write("assets/8e3a7f.png", new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
  await vfs.write(
    "themes-recovery/org.example.practice/package/theme.json",
    enc.encode(JSON.stringify({ formatVersion: 1, id: "org.example.practice", version: "1.0.0" })),
  );
  await vfs.write(
    "themes-recovery/org.example.practice/blocks.json",
    enc.encode(JSON.stringify({ version: "1.0.0", blocks: { blk_partners: PARTNERS_BLOCK } })),
  );
  return vfs;
}

describe("Custom Blocks in the editable archive", () => {
  test("an archive save with a Custom Block nobody declares is refused, not written with a hole", async () => {
    await expect(exportToZip(siteWithBlock(), await siteVfs())).rejects.toBeInstanceOf(
      BuildCustomBlockMissingError,
    );
  });

  test("the editor's validation names the Block as unavailable and blocking, data untouched", () => {
    const site = siteWithBlock();
    const result = validate(site, { customBlocks: EMPTY_CUSTOM_BLOCK_REGISTRY });
    expect(hasBlockingIssues(result)).toBe(true);
    expect(result.errors.map((i) => i.code)).toContain("block.custom.unavailable.package-missing");
    expect(site.pages[0]!.blocks.at(-1)).toEqual(PARTNERS_BLOCK);
  });

  test("an archive written elsewhere reopens with the Block's data, files and recovery copy intact", async () => {
    // Write the archive by hand, as an editor that *had* the package would
    // have — `data.json`, the image, the recovery copy — and open it here,
    // where the package is missing.
    const driver = new ZipDriver();
    await driver.write("data.json", enc.encode(JSON.stringify(siteWithBlock(), null, 2) + "\n"));
    const vfs = await siteVfs();
    for (const path of await vfs.list()) await driver.write(path, await vfs.read(path));
    const blob = new Blob([driver.toZipBytes()], { type: "application/zip" });

    const imported = await importFromZip(blob);
    const block = imported.siteData.pages[0]!.blocks.at(-1);
    expect(block).toEqual(PARTNERS_BLOCK);
    expect(await imported.vfs.has("assets/8e3a7f.png")).toBe(true);
    const recovery = await readThemeRecoveryCopy(imported.vfs, "org.example.practice");
    expect(recovery?.version).toBe("1.0.0");
    expect(recovery?.blocks.get("blk_partners")).toEqual(PARTNERS_BLOCK);

    // Saving again, with the Block still unavailable, is still refused; the
    // data itself is untouched by the attempt.
    await expect(exportToZip(imported.siteData, imported.vfs)).rejects.toBeInstanceOf(
      BuildCustomBlockMissingError,
    );
    expect(imported.siteData.pages[0]!.blocks.at(-1)).toEqual(PARTNERS_BLOCK);
  });

  test("the recovery copy round-trips through export and import once the Block is gone", async () => {
    const site = structuredClone(historipol) as unknown as Site;
    const imported = await importFromZip(await exportToZip(site, await siteVfs()));
    expect(await imported.vfs.list("themes-recovery/")).toEqual([
      "themes-recovery/org.example.practice/blocks.json",
      "themes-recovery/org.example.practice/package/theme.json",
    ]);
    // Never mirrored into the public Site.
    const inspector = ZipDriver.fromZipBytes(
      new Uint8Array(await (await exportToZip(site, imported.vfs)).arrayBuffer()),
    );
    expect((await inspector.list("dist/")).some((p) => p.includes("themes-recovery"))).toBe(false);
  });
});
