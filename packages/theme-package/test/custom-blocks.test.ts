/**
 * Custom Block declarations in a Theme package (ADR 0055).
 *
 * What a package has to say to declare a Custom Block type, exactly how a
 * declaration this builder cannot honour is refused — file and field named,
 * package unchanged — and how the editor learns about packages that will not
 * load at all. Plus the recovery copy an update leaves behind.
 */

import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { MemoryDriver } from "@sosb/vfs/memory";
import type { ThemeBundle } from "@sosb/renderer";
import type { BlockEnvelope, Site } from "@sosb/schema";
import {
  ThemePackageError,
  declaredCustomBlockTypes,
  discardThemeRecoveryCopy,
  initThemeSandbox,
  installThemePackageIntoVfs,
  loadInstalledThemePackages,
  loadThemePackage,
  loadThemePackageFromZip,
  exportThemePackage,
  readThemeRecoveryCopy,
  restoreRecoveredBlocks,
  saveThemeRecoveryCopy,
  themeRecoveryIds,
} from "../src/index.js";

const enc = new TextEncoder();
const THEME_ID = "org.example.blocks";

const MANIFEST = {
  formatVersion: 1,
  id: THEME_ID,
  name: "Blocks",
  version: "1.0.0",
  builder: { formatVersion: 1 },
  css: "theme.css",
};

const PARTNERS = {
  formatVersion: 1,
  type: "org.example/partners",
  version: 1,
  label: { default: "Partners", ro: "Parteneri" },
  fields: [
    { name: "heading", kind: "text", label: "Heading", required: true },
    {
      name: "partners",
      kind: "list",
      label: "Partners",
      item: {
        kind: "group",
        fields: [
          { name: "name", kind: "text", label: "Name" },
          { name: "image", kind: "image", label: "Logo" },
          { name: "link", kind: "link", label: "Link" },
        ],
      },
    },
  ],
};

function pkg(
  manifest: unknown,
  files: Record<string, string | object> = {},
): Map<string, Uint8Array> {
  const out = new Map<string, Uint8Array>();
  out.set("theme.json", enc.encode(JSON.stringify(manifest)));
  out.set("theme.css", enc.encode("body{color:red}"));
  for (const [path, body] of Object.entries(files)) {
    out.set(path, enc.encode(typeof body === "string" ? body : JSON.stringify(body)));
  }
  return out;
}

function expectRejection(files: Map<string, Uint8Array>, code: string, message: RegExp): void {
  try {
    loadThemePackage(files);
  } catch (error) {
    expect(error).toBeInstanceOf(ThemePackageError);
    expect((error as ThemePackageError).code).toBe(code);
    expect((error as ThemePackageError).message).toMatch(message);
    return;
  }
  throw new Error(`expected loadThemePackage to reject with ${code}`);
}

const opened: ThemeBundle[] = [];
beforeAll(async () => {
  await initThemeSandbox();
}, 60_000);
afterAll(() => {
  for (const b of opened) b.render?.dispose();
});

describe("manifest: blocks", () => {
  test("a listed block.json becomes a declaration on the bundle", () => {
    const { bundle } = loadThemePackage(
      pkg(
        { ...MANIFEST, blocks: ["blocks/partners/block.json"] },
        {
          "blocks/partners/block.json": PARTNERS,
        },
      ),
    );
    expect(bundle.customBlocks?.map((d) => d.type)).toEqual(["org.example/partners"]);
    expect(bundle.customBlocks?.[0]?.version).toBe(1);
  });

  test("a package without blocks declares none, and a declaration is not a design", () => {
    const { bundle } = loadThemePackage(pkg(MANIFEST));
    expect(bundle.customBlocks).toEqual([]);
    const declared = loadThemePackage(
      pkg(
        { ...MANIFEST, blocks: ["blocks/partners/block.json"] },
        {
          "blocks/partners/block.json": PARTNERS,
        },
      ),
    );
    expect(declared.bundle.render).toBeUndefined();
  });

  test("names a file that must exist", () => {
    expectRejection(
      pkg({ ...MANIFEST, blocks: ["blocks/partners/block.json"] }),
      "file-missing",
      /blocks\/partners\/block\.json.*does not contain it/,
    );
  });

  test("follows the same path rules as fonts", () => {
    expectRejection(
      pkg({ ...MANIFEST, blocks: ["../block.json"] }),
      "manifest-invalid",
      /blocks\.0/,
    );
  });

  test("a block.json that is not JSON", () => {
    expectRejection(
      pkg({ ...MANIFEST, blocks: ["blocks/p/block.json"] }, { "blocks/p/block.json": "{" }),
      "block-invalid",
      /not valid JSON/,
    );
  });

  test("an unsupported field kind is refused with the file, the field and the supported kinds named", () => {
    expectRejection(
      pkg(
        { ...MANIFEST, blocks: ["blocks/p/block.json"] },
        {
          "blocks/p/block.json": {
            ...PARTNERS,
            fields: [{ name: "tint", kind: "color", label: "Tint" }],
          },
        },
      ),
      "block-invalid",
      /blocks\/p\/block\.json: Field "fields\.tint" declares kind "color".*Supported kinds: text, richText, number/,
    );
  });

  test("a declaration from a newer builder asks for a newer builder, with its own code", () => {
    expectRejection(
      pkg(
        { ...MANIFEST, blocks: ["blocks/p/block.json"] },
        {
          "blocks/p/block.json": { ...PARTNERS, formatVersion: 2 },
        },
      ),
      "block-format-unsupported",
      /format version 2.*Update the builder/,
    );
  });

  test("a type declared twice in one package", () => {
    expectRejection(
      pkg(
        { ...MANIFEST, blocks: ["blocks/a/block.json", "blocks/b/block.json"] },
        {
          "blocks/a/block.json": PARTNERS,
          "blocks/b/block.json": { ...PARTNERS, label: "Again" },
        },
      ),
      "block-invalid",
      /declares the Custom Block type "org.example\/partners", which "blocks\/a\/block\.json".*already declares/,
    );
  });

  test("declarations are checked before the design is compiled", () => {
    // A package whose render.js would also fail: the declaration error wins,
    // proving no sandbox realm was created for a package that is then refused.
    expectRejection(
      pkg(
        { ...MANIFEST, blocks: ["blocks/p/block.json"], render: "render.js" },
        {
          "blocks/p/block.json": { ...PARTNERS, fields: [] },
          "render.js": "export default { blocks: {",
        },
      ),
      "block-invalid",
      /blocks\/p\/block\.json/,
    );
  });

  test("round-trips through a .sosb-theme.zip, block.json included", async () => {
    const loaded = loadThemePackage(
      pkg(
        { ...MANIFEST, blocks: ["blocks/partners/block.json"] },
        {
          "blocks/partners/block.json": PARTNERS,
        },
      ),
    );
    const again = await loadThemePackageFromZip(exportThemePackage(loaded));
    expect(again.bundle.customBlocks).toEqual(loaded.bundle.customBlocks);
    expect(again.files.has("blocks/partners/block.json")).toBe(true);
  });
});

describe("declaredCustomBlockTypes — the lenient read", () => {
  test("reads type ids even from a package this builder cannot load", () => {
    const files = pkg(
      { ...MANIFEST, formatVersion: 2, blocks: ["blocks/p/block.json"] },
      {
        "blocks/p/block.json": { ...PARTNERS, formatVersion: 2, fields: [{ kind: "hologram" }] },
      },
    );
    expect(declaredCustomBlockTypes(files)).toEqual(["org.example/partners"]);
  });

  test("answers [] for anything unreadable, never throws", () => {
    expect(declaredCustomBlockTypes(new Map())).toEqual([]);
    expect(declaredCustomBlockTypes(pkg({ ...MANIFEST, blocks: "nope" }))).toEqual([]);
    expect(
      declaredCustomBlockTypes(
        pkg({ ...MANIFEST, blocks: ["blocks/p/block.json"] }, { "blocks/p/block.json": "{" }),
      ),
    ).toEqual([]);
    expect(
      declaredCustomBlockTypes(
        pkg(
          { ...MANIFEST, blocks: ["blocks/p/block.json"] },
          {
            "blocks/p/block.json": { type: "notNamespaced" },
          },
        ),
      ),
    ).toEqual([]);
  });
});

describe("loadInstalledThemePackages", () => {
  test("reports loaded packages and, for failures, the error and the declared types", async () => {
    const vfs = new MemoryDriver();
    const good = loadThemePackage(
      pkg(
        { ...MANIFEST, blocks: ["blocks/partners/block.json"] },
        {
          "blocks/partners/block.json": PARTNERS,
        },
      ),
    );
    await installThemePackageIntoVfs(vfs, good);
    // A future package, written straight into the VFS as an archive would carry it.
    const future = pkg(
      { ...MANIFEST, id: "org.example.future", formatVersion: 2, blocks: ["blocks/p/block.json"] },
      { "blocks/p/block.json": { ...PARTNERS, type: "org.example/future" } },
    );
    for (const [path, bytes] of future) await vfs.write(`themes/org.example.future/${path}`, bytes);

    const reports = await loadInstalledThemePackages(vfs);
    expect(reports.map((r) => r.id)).toEqual([THEME_ID, "org.example.future"]);
    const [ok, failed] = reports;
    expect(ok?.loaded?.bundle.customBlocks?.map((d) => d.type)).toEqual(["org.example/partners"]);
    expect(failed?.error?.code).toBe("format-version-unsupported");
    expect(failed?.error === undefined ? [] : failed.declaredBlockTypes).toEqual([
      "org.example/future",
    ]);
    for (const report of reports) report.loaded?.bundle.render?.dispose();
  });
});

describe("the recovery copy", () => {
  const block: BlockEnvelope = {
    id: "blk_1",
    type: "org.example/partners",
    version: 1,
    data: { heading: "Old heading", partners: [{ name: "Alpha" }] },
  };

  test("saves the previous package and Block envelopes, reads them back, and restores by id", async () => {
    const vfs = new MemoryDriver();
    const previous = loadThemePackage(
      pkg(
        { ...MANIFEST, blocks: ["blocks/partners/block.json"] },
        {
          "blocks/partners/block.json": PARTNERS,
        },
      ),
    );
    await saveThemeRecoveryCopy(vfs, previous, [block]);
    expect(await themeRecoveryIds(vfs)).toEqual([THEME_ID]);
    expect(await vfs.has(`themes-recovery/${THEME_ID}/package/blocks/partners/block.json`)).toBe(
      true,
    );

    const copy = await readThemeRecoveryCopy(vfs, THEME_ID);
    expect(copy?.version).toBe("1.0.0");
    expect([...copy!.files.keys()].sort()).toEqual([...previous.files.keys()].sort());
    expect(copy?.blocks.get("blk_1")).toEqual(block);

    const site = {
      pages: [
        {
          blocks: [
            { ...block, version: 2, data: { heading: "New", tagline: "added" }, variant: "band" },
            { id: "blk_new", type: "org.example/partners", version: 2, data: {} },
          ],
        },
      ],
    } as unknown as Site;
    const restored = restoreRecoveredBlocks(site, copy!);
    expect(restored).not.toBe(site);
    expect(restored.pages[0]!.blocks[0]).toEqual({ ...block, variant: "band" });
    // A Block added since the update is left alone.
    expect(restored.pages[0]!.blocks[1]).toEqual(site.pages[0]!.blocks[1]);
    // The package files can be loaded again as they were.
    const reloaded = loadThemePackage(copy!.files);
    expect(reloaded.bundle.version).toBe("1.0.0");

    await discardThemeRecoveryCopy(vfs, THEME_ID);
    expect(await themeRecoveryIds(vfs)).toEqual([]);
    expect(await readThemeRecoveryCopy(vfs, THEME_ID)).toBeUndefined();
  });

  test("a second update replaces the first copy", async () => {
    const vfs = new MemoryDriver();
    const v1 = loadThemePackage(pkg({ ...MANIFEST, version: "1.0.0" }, { "extra.txt": "one" }));
    const v2 = loadThemePackage(pkg({ ...MANIFEST, version: "2.0.0" }));
    await saveThemeRecoveryCopy(vfs, v1, []);
    await saveThemeRecoveryCopy(vfs, v2, []);
    const copy = await readThemeRecoveryCopy(vfs, THEME_ID);
    expect(copy?.version).toBe("2.0.0");
    expect(copy?.files.has("extra.txt")).toBe(false);
  });

  test("restoring with no matching Block returns the same Site", () => {
    const site = { pages: [{ blocks: [] }] } as unknown as Site;
    const copy = {
      id: THEME_ID,
      version: "1.0.0",
      files: new Map(),
      blocks: new Map([["x", block]]),
    };
    expect(restoreRecoveredBlocks(site, copy)).toBe(site);
  });
});
