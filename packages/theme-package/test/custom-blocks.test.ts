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
    // `null` parses as JSON and is not an object: neither file may throw.
    const enc = new TextEncoder();
    expect(declaredCustomBlockTypes(new Map([["theme.json", enc.encode("null")]]))).toEqual([]);
    expect(
      declaredCustomBlockTypes(
        pkg({ ...MANIFEST, blocks: ["blocks/p/block.json"] }, { "blocks/p/block.json": "null" }),
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

  test("a write that fails half-way leaves the earlier copy whole", async () => {
    const vfs = new MemoryDriver();
    const v1 = loadThemePackage(
      pkg(
        { ...MANIFEST, version: "1.0.0", blocks: ["blocks/partners/block.json"] },
        {
          "blocks/partners/block.json": PARTNERS,
        },
      ),
    );
    const v2 = loadThemePackage(
      pkg(
        { ...MANIFEST, version: "2.0.0", blocks: ["blocks/partners/block.json"] },
        {
          "blocks/partners/block.json": PARTNERS,
        },
      ),
    );
    await saveThemeRecoveryCopy(vfs, v1, [block]);
    // Fail on the second write of the next save: the new copy never completes.
    let writes = 0;
    const flaky = new Proxy(vfs, {
      get(target, property, receiver) {
        if (property === "write") {
          return async (path: string, bytes: Uint8Array) => {
            writes += 1;
            if (writes === 2) throw new Error("disk full");
            return target.write(path, bytes);
          };
        }
        return Reflect.get(target, property, receiver);
      },
    });
    await expect(saveThemeRecoveryCopy(flaky, v2, [])).rejects.toThrow("disk full");
    const copy = await readThemeRecoveryCopy(vfs, THEME_ID);
    expect(copy?.version).toBe("1.0.0");
    expect(copy?.blocks.get("blk_1")).toEqual(block);
    expect(copy?.files.size).toBe(v1.files.size);
    // Failed staging is cleaned immediately, without another save.
    expect(await vfs.list("themes-recovery-staging/")).toEqual([]);
    expect(await themeRecoveryIds(vfs)).toEqual([THEME_ID]);
    await saveThemeRecoveryCopy(vfs, v2, []);
    expect((await readThemeRecoveryCopy(vfs, THEME_ID))?.version).toBe("2.0.0");
    expect(await vfs.list("themes-recovery-staging/")).toEqual([]);
  });

  test.each(["staged read", "backup write", "live write", "obsolete delete"])(
    "%s failure retains every previous recovery byte and cleans staging",
    async (failure) => {
      const vfs = new MemoryDriver();
      const v1 = loadThemePackage(pkg(MANIFEST, { "extra.txt": "old file" }));
      const v2 = loadThemePackage(pkg({ ...MANIFEST, version: "2.0.0" }));
      await saveThemeRecoveryCopy(vfs, v1, [block]);
      const before = await readThemeRecoveryCopy(vfs, THEME_ID);
      const live = `themes-recovery/${THEME_ID}/`;
      let failed = false;
      let liveWrites = 0;
      const flaky = new Proxy(vfs, {
        get(target, property, receiver) {
          if (property === "read" || property === "write" || property === "delete") {
            return async (path: string, bytes?: Uint8Array) => {
              if (property === "write" && path.startsWith(live)) liveWrites += 1;
              const matches =
                (failure === "staged read" &&
                  property === "read" &&
                  path.startsWith("themes-recovery-staging/")) ||
                (failure === "backup write" &&
                  property === "write" &&
                  path.startsWith("themes-recovery-backup/")) ||
                (failure === "live write" &&
                  property === "write" &&
                  path.startsWith(live) &&
                  liveWrites === 2) ||
                (failure === "obsolete delete" &&
                  property === "delete" &&
                  path === live + "package/extra.txt");
              if (!failed && matches) {
                failed = true;
                throw new Error("storage failed");
              }
              if (property === "write") return target.write(path, bytes!);
              return target[property](path);
            };
          }
          return Reflect.get(target, property, receiver);
        },
      });
      await expect(saveThemeRecoveryCopy(flaky, v2, [])).rejects.toThrow("storage failed");
      expect(failed).toBe(true);
      expect(await readThemeRecoveryCopy(vfs, THEME_ID)).toEqual(before);
      expect(await vfs.list("themes-recovery-staging/")).toEqual([]);
      expect(await vfs.list("themes-recovery-backup/")).toEqual([]);
    },
  );

  test("a failed rollback retains its backup, which the next save restores before retrying", async () => {
    const vfs = new MemoryDriver();
    const v1 = loadThemePackage(pkg(MANIFEST, { "extra.txt": "old file" }));
    const v2 = loadThemePackage(pkg({ ...MANIFEST, version: "2.0.0" }));
    await saveThemeRecoveryCopy(vfs, v1, [block]);
    const live = `themes-recovery/${THEME_ID}/`;
    let writes = 0;
    const flaky = new Proxy(vfs, {
      get(target, property, receiver) {
        if (property === "write") {
          return async (path: string, bytes: Uint8Array) => {
            if (path.startsWith(live) && ++writes >= 2) throw new Error("disk unavailable");
            return target.write(path, bytes);
          };
        }
        return Reflect.get(target, property, receiver);
      },
    });
    await expect(saveThemeRecoveryCopy(flaky, v2, [])).rejects.toThrow(
      "previous files are retained",
    );
    const backup = `themes-recovery-backup/${THEME_ID}/`;
    expect(await vfs.has(backup + ".ready")).toBe(true);
    expect(await vfs.read(backup + live + "package/extra.txt")).toEqual(enc.encode("old file"));
    expect(await vfs.list("themes-recovery-staging/")).toEqual([]);
    // Fail the retry after it restores the pending backup, during the next
    // outgoing snapshot read. The old point must now be fully readable.
    let sawRestore = false;
    const retry = new Proxy(vfs, {
      get(target, property, receiver) {
        if (property === "read") {
          return async (path: string) => {
            if (path.startsWith(live)) {
              sawRestore = true;
              throw new Error("retry read failed");
            }
            return target.read(path);
          };
        }
        return Reflect.get(target, property, receiver);
      },
    });
    await expect(saveThemeRecoveryCopy(retry, v2, [])).rejects.toThrow("retry read failed");
    expect(sawRestore).toBe(true);
    expect((await readThemeRecoveryCopy(vfs, THEME_ID))?.version).toBe("1.0.0");
    expect((await readThemeRecoveryCopy(vfs, THEME_ID))?.blocks.get(block.id)).toEqual(block);
    await saveThemeRecoveryCopy(vfs, v2, []);
    expect((await readThemeRecoveryCopy(vfs, THEME_ID))?.version).toBe("2.0.0");
    expect(await vfs.list("themes-recovery-backup/")).toEqual([]);
  });

  test.each(["package", "recovery"])(
    "a failed %s transfer restores the installed package and earlier restore point together",
    async (phase) => {
      const vfs = new MemoryDriver();
      const v1 = loadThemePackage(pkg(MANIFEST, { "extra.txt": "v1" }));
      const v2 = loadThemePackage(pkg({ ...MANIFEST, version: "2.0.0" }, { "extra.txt": "v2" }));
      const v3 = loadThemePackage(pkg({ ...MANIFEST, version: "3.0.0" }));
      await saveThemeRecoveryCopy(vfs, v1, [block]);
      await installThemePackageIntoVfs(vfs, v2);
      const before = new Map<string, Uint8Array>();
      for (const path of await vfs.list()) before.set(path, await vfs.read(path));
      const live = phase === "package" ? `themes/${THEME_ID}/` : `themes-recovery/${THEME_ID}/`;
      let writes = 0;
      const flaky = new Proxy(vfs, {
        get(target, property, receiver) {
          if (property === "write") {
            return async (path: string, bytes: Uint8Array) => {
              if (path.startsWith(live) && ++writes === 2) throw new Error("transfer failed");
              return target.write(path, bytes);
            };
          }
          return Reflect.get(target, property, receiver);
        },
      });
      await expect(
        installThemePackageIntoVfs(flaky, v3, {
          previous: v2,
          blocks: [{ ...block, version: 2 }],
        }),
      ).rejects.toThrow("transfer failed");
      const after = new Map<string, Uint8Array>();
      for (const path of await vfs.list()) after.set(path, await vfs.read(path));
      expect(after).toEqual(before);
    },
  );

  test("a blocks.json with malformed envelopes keeps only the well-formed ones", async () => {
    const vfs = new MemoryDriver();
    const enc = new TextEncoder();
    await vfs.write(
      `themes-recovery/${THEME_ID}/blocks.json`,
      enc.encode(
        JSON.stringify({
          version: "1.0.0",
          blocks: { blk_1: block, blk_null: null, blk_bare: { id: "blk_bare", type: "x" } },
        }),
      ),
    );
    const copy = await readThemeRecoveryCopy(vfs, THEME_ID);
    expect([...copy!.blocks.keys()]).toEqual(["blk_1"]);
    // And a file that is not an object at all leaves the copy readable.
    await vfs.write(`themes-recovery/${THEME_ID}/blocks.json`, enc.encode("null"));
    expect((await readThemeRecoveryCopy(vfs, THEME_ID))?.blocks.size).toBe(0);
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
