/** @jsxImportSource react */
// @vitest-environment jsdom
/**
 * Custom Blocks through the whole `<EditorApp>` (ADR 0055).
 *
 * The declaring package is installed in the Site VFS the way an archive
 * carries it, so what is tested is the registry the editor actually derives
 * from `themes/`: the Add Block dialog, the generated Inspector form, the
 * unavailable states (package missing, package needing a newer builder), the
 * export readiness gate, the author-controlled update with its confirmation,
 * and the recovery copy's restore.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import type { BlockEnvelope, Site } from "@sosb/schema";
import { MemoryDriver } from "@sosb/vfs/memory";
import { ZipDriver } from "@sosb/vfs/zip-driver";
import {
  loadThemePackage,
  readThemeRecoveryCopy,
  saveThemeRecoveryCopy,
} from "@sosb/theme-package";

import minimal from "./fixtures/minimal-site.json" with { type: "json" };
import {
  PARTNERS_DECLARATION,
  PARTNERS_PACKAGE_ID,
  PARTNERS_TYPE,
  partnersPackageFiles,
  vfsWithPartnersPackage,
} from "./fixtures/partners-package.js";
import { openPage, openSection, setViewportWidth } from "./helpers/nav.js";
import { EditorApp } from "../src/editor-app.js";

const enc = new TextEncoder();

function cleanSite(): Site {
  const site = structuredClone(minimal) as unknown as Site;
  site.theme.tokens = {
    ...(site.theme.tokens ?? {}),
    colorPrimary: "#1f3a5f",
    colorAccent: "#7a2d16",
  };
  return site;
}

const PARTNERS_BLOCK: BlockEnvelope = {
  id: "blk_partners",
  type: PARTNERS_TYPE,
  version: 1,
  data: {
    heading: "Our partners",
    layout: "roomy",
    groups: [{ heading: "Gold", partners: [{ name: "Alpha" }] }],
  },
};

function siteWithPartners(): Site {
  const site = cleanSite();
  site.pages[0]!.blocks.push(structuredClone(PARTNERS_BLOCK));
  return site;
}

function q<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
  const found = root.querySelector<T>(selector);
  if (found === null) throw new Error(`missing ${selector}`);
  return found;
}

/**
 * Export through the readiness panel, ticking the omission acknowledgement
 * when the panel asks for it: the declared type has no design in the built-in
 * Theme, so it is an omitted Block (ADR 0045) on every export here.
 */
function exportSite(container: HTMLElement): void {
  fireEvent.click(q(container, 'button[data-action="export"]'));
  const panel = q(container, '[data-testid="export-readiness"]');
  const ack = panel.querySelector<HTMLInputElement>('[data-testid="export-omitted-ack"]');
  if (ack !== null) fireEvent.click(ack);
  const phrase = panel.querySelector<HTMLInputElement>('[data-testid="export-confirm-input"]');
  if (phrase !== null) fireEvent.input(phrase, { target: { value: "DOWNLOAD" } });
  fireEvent.click(q(panel, '[data-testid="export-confirm-button"]'));
}

/** Open the first page and drill into the Block at `index`. */
function openBlock(container: HTMLElement, index: number): HTMLElement {
  openPage(container, 0);
  const rows = container.querySelectorAll<HTMLButtonElement>('[data-testid="block-row-select"]');
  fireEvent.click(rows[index]!);
  return q(container, '[data-testid="inspector"]');
}

/** Wait until the shell has read `themes/` — the Theme destination lists the packages. */
async function packagesLoaded(container: HTMLElement, id = PARTNERS_PACKAGE_ID): Promise<void> {
  openSection(container, "theme");
  await waitFor(() => {
    if (container.querySelector(`[data-theme-package][data-theme-id="${id}"]`) === null) {
      throw new Error("packages not loaded yet");
    }
  });
}

beforeEach(() => setViewportWidth(1200));
afterEach(() => cleanup());

describe("adding and editing a Custom Block", () => {
  test("the Add Block dialog offers it under its label and adds an empty Block at the declared version", async () => {
    const snapshots: Site[] = [];
    const { container } = render(
      <EditorApp
        initial={cleanSite()}
        initialAssetVfs={await vfsWithPartnersPackage()}
        onExport={(s) => snapshots.push(s)}
      />,
    );
    await packagesLoaded(container);
    openPage(container, 0);
    fireEvent.click(q(container, '[data-testid="block-add"]'));
    const group = q(container, '[data-testid="add-block-group"][data-category="custom"]');
    expect(group.querySelector("h3")?.textContent).toContain("From your Theme packages");
    const entry = q<HTMLButtonElement>(group, `[data-block-type="${PARTNERS_TYPE}"]`);
    expect(entry.querySelector('[data-testid="add-block-entry-label"]')?.textContent).toBe(
      "Partners",
    );
    expect(entry.querySelector('[data-testid="add-block-entry-description"]')?.textContent).toBe(
      "Partner logos in groups.",
    );
    fireEvent.click(entry);

    const rows = container.querySelectorAll('[data-testid="block-row"]');
    const added = rows[rows.length - 1]!;
    expect(added.querySelector('[data-testid="block-row-label"]')?.textContent).toBe("Partners");
    // What was written: the declaration's version, and only the declared defaults.
    exportSite(container);
    const block = snapshots[0]!.pages[0]!.blocks.at(-1)!;
    expect(block.type).toBe(PARTNERS_TYPE);
    expect(block.version).toBe(1);
    expect(block.data).toEqual({ showHeadings: true, layout: "tight" });
  });

  test("the Inspector generates the form from the declaration and edits reach the Site", async () => {
    const snapshots: Site[] = [];
    const { container } = render(
      <EditorApp
        initial={siteWithPartners()}
        initialAssetVfs={await vfsWithPartnersPackage()}
        onExport={(s) => snapshots.push(s)}
      />,
    );
    await packagesLoaded(container);
    const inspector = openBlock(container, 1);
    expect(inspector.getAttribute("data-block-type")).toBe(PARTNERS_TYPE);
    expect(container.querySelector('[data-testid="inspector-eyebrow"]')?.textContent).toBe(
      "Partners",
    );
    expect(inspector.querySelector('[data-testid="inspector-unavailable"]')).toBeNull();
    const heading = q<HTMLInputElement>(inspector, 'input[data-field="heading"]');
    expect(heading.value).toBe("Our partners");
    expect(q(inspector, 'input[data-field="groups.0.partners.0.name"]')).toBeDefined();
    expect(q(inspector, '[data-testid="link-target-select"]')).toBeDefined();
    expect(
      inspector.querySelector('[data-testid="inspector-custom-provided"]')?.textContent,
    ).toContain(PARTNERS_PACKAGE_ID);

    fireEvent.input(heading, { target: { value: "Partners 2026" } });
    exportSite(container);
    expect((snapshots[0]!.pages[0]!.blocks[1]!.data as { heading: string }).heading).toBe(
      "Partners 2026",
    );
  });

  test("validation findings appear beside the fields and in the export readiness panel", async () => {
    const site = siteWithPartners();
    (site.pages[0]!.blocks[1]!.data as { heading: string }).heading = "";
    const { container } = render(
      <EditorApp initial={site} initialAssetVfs={await vfsWithPartnersPackage()} />,
    );
    await packagesLoaded(container);
    const inspector = openBlock(container, 1);
    const beside = inspector.querySelector('[data-field-label="heading"] [data-field-issue]');
    expect(beside?.textContent).toBe('"Heading" is required but empty.');

    fireEvent.click(q(container, 'button[data-action="export"]'));
    const panel = q(container, '[data-testid="export-readiness"]');
    const warnings = panel.querySelector('[data-testid="export-warnings"]');
    expect(warnings?.textContent).toContain('"Heading" is required but empty.');
    // A content rule is a warning: no phrase is asked for and nothing blocks.
    // (The checkbox is the omission gate — the built-in Theme has no design
    // for the type — not the warning's doing.)
    expect(panel.querySelector('[data-testid="export-confirm-input"]')).toBeNull();
    expect(panel.querySelector('[data-testid="export-blocked-note"]')).toBeNull();
    fireEvent.click(q(panel, '[data-testid="export-omitted-ack"]'));
    expect(q<HTMLButtonElement>(panel, '[data-testid="export-confirm-button"]').disabled).toBe(
      false,
    );
  });
});

describe("unavailable Custom Blocks", () => {
  test("a Block whose package is missing is shown as such, not editable, and blocks the export", async () => {
    const { container } = render(
      <EditorApp initial={siteWithPartners()} initialAssetVfs={new MemoryDriver()} />,
    );
    // Nothing to wait for in `themes/`; the first read still has to complete.
    openPage(container, 0);
    await waitFor(() => {
      if (container.querySelector('[data-testid="block-row-unavailable"]') === null) {
        throw new Error("not yet marked");
      }
    });
    const rows = container.querySelectorAll('[data-testid="block-row"]');
    expect(rows[1]!.getAttribute("data-unavailable")).toBe("true");
    expect(rows[1]!.querySelector('[data-testid="block-row-label"]')?.textContent).toBe("Partners");

    fireEvent.click(rows[1]!.querySelector<HTMLButtonElement>('[data-testid="block-row-select"]')!);
    const notice = q(container, '[data-testid="inspector-unavailable"]');
    expect(notice.getAttribute("data-reason")).toBe("package-missing");
    expect(notice.textContent).toContain("is not installed");
    expect(container.querySelector('[data-testid="block-form"]')).toBeNull();
    expect(container.querySelector("textarea")).toBeNull();

    fireEvent.click(q(container, 'button[data-action="export"]'));
    const panel = q(container, '[data-testid="export-readiness"]');
    expect(panel.querySelector('[data-testid="export-blocked-note"]')).not.toBeNull();
    const blocker = panel.querySelector('[data-testid="export-blockers"] [data-finding]');
    expect(blocker?.getAttribute("data-code")).toBe("block.custom.unavailable.package-missing");
    expect(blocker?.getAttribute("data-blocking")).toBe("true");
    // Not an omission: nothing to acknowledge, the export is simply blocked.
    expect(panel.querySelector('[data-testid="export-omitted-blocks"]')).toBeNull();
    expect(q<HTMLButtonElement>(panel, '[data-testid="export-confirm-button"]').disabled).toBe(
      true,
    );
  });

  test("a package that needs a newer builder names itself as the reason", async () => {
    const vfs = new MemoryDriver();
    for (const [path, bytes] of partnersPackageFiles({ id: "org.example.future" })) {
      const text = new TextDecoder().decode(bytes);
      const future =
        path === "theme.json" ? text.replace('"formatVersion":1', '"formatVersion":2') : text;
      await vfs.write(`themes/org.example.future/${path}`, enc.encode(future));
    }
    const { container } = render(<EditorApp initial={siteWithPartners()} initialAssetVfs={vfs} />);
    openPage(container, 0);
    await waitFor(() => {
      if (container.querySelector('[data-testid="block-row-unavailable"]') === null) {
        throw new Error("not yet marked");
      }
    });
    fireEvent.click(
      container.querySelectorAll<HTMLButtonElement>('[data-testid="block-row-select"]')[1]!,
    );
    const notice = q(container, '[data-testid="inspector-unavailable"]');
    expect(notice.getAttribute("data-reason")).toBe("needs-newer-builder");
    expect(notice.textContent).toContain("org.example.future");
    expect(notice.textContent).toContain("newer version of the builder");
  });

  test("a Block saved by a newer package than the installed one is unavailable", async () => {
    const site = siteWithPartners();
    site.pages[0]!.blocks[1]!.version = 5;
    const { container } = render(
      <EditorApp initial={site} initialAssetVfs={await vfsWithPartnersPackage()} />,
    );
    await packagesLoaded(container);
    const inspector = openBlock(container, 1);
    expect(q(inspector, '[data-testid="inspector-unavailable"]').getAttribute("data-reason")).toBe(
      "data-newer",
    );
  });
});

describe("author-controlled package updates", () => {
  /** A `.sosb-theme.zip` of the package with the given declaration. */
  function packageZip(overrides: Parameters<typeof partnersPackageFiles>[0]): File {
    const driver = new ZipDriver();
    for (const [path, bytes] of partnersPackageFiles(overrides)) void driver.write(path, bytes);
    const bytes = driver.toZipBytes();
    const file = new File([bytes], "declaring.sosb-theme.zip", { type: "application/zip" });
    // jsdom's File does not implement arrayBuffer(); the shell reads it that way.
    if (typeof file.arrayBuffer !== "function") {
      Object.defineProperty(file, "arrayBuffer", {
        value: () =>
          Promise.resolve(
            bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
          ),
      });
    }
    return file;
  }

  async function importPackage(container: HTMLElement, file: File): Promise<void> {
    openSection(container, "theme");
    const input = q<HTMLInputElement>(container, '[data-testid="theme-import-input"]');
    fireEvent.change(input, { target: { files: [file] } });
  }

  /** v2 drops `layout` (which holds "roomy") and adds a partner description. */
  const V2 = {
    ...PARTNERS_DECLARATION,
    version: 2,
    fields: PARTNERS_DECLARATION.fields
      .filter((field) => field.name !== "layout")
      .map((field) =>
        field.name !== "groups"
          ? field
          : {
              ...field,
              item: {
                kind: "group",
                fields: [
                  { name: "heading", kind: "text", label: "Group heading" },
                  {
                    name: "partners",
                    kind: "list",
                    label: "Partners",
                    item: {
                      kind: "group",
                      fields: [
                        { name: "name", kind: "text", label: "Name" },
                        { name: "description", kind: "text", label: "Description" },
                        { name: "image", kind: "image", label: "Logo" },
                        { name: "link", kind: "link", label: "Link" },
                      ],
                    },
                  },
                ],
              },
            },
      ),
  };

  test("an update that removes content asks first, and cancelling changes nothing", async () => {
    const vfs = await vfsWithPartnersPackage();
    const snapshots: Site[] = [];
    const { container } = render(
      <EditorApp
        initial={siteWithPartners()}
        initialAssetVfs={vfs}
        onExport={(s) => snapshots.push(s)}
      />,
    );
    await packagesLoaded(container);
    await importPackage(container, packageZip({ version: "2.0.0", declaration: V2 }));
    const dialog = await waitFor(() => q(container, '[data-testid="package-update-dialog"]'));
    expect(dialog.querySelector("h2")?.textContent).toBe("Update “Declaring” to version 2.0.0?");
    const removed = dialog.querySelectorAll('[data-testid="package-update-removed"] li');
    expect(removed).toHaveLength(1);
    // The Block and the field are named by the outgoing declaration's labels,
    // never by the type id.
    expect(removed[0]!.textContent).toBe("Acasă, Partners — Layout: roomy");

    fireEvent.click(q(dialog, '[data-testid="package-update-cancel"]'));
    expect(container.querySelector('[data-testid="package-update-dialog"]')).toBeNull();
    // Still version 1.0.0, nothing written, no recovery copy.
    expect(container.querySelector("[data-theme-package-version]")?.textContent).toBe("v1.0.0");
    expect(await readThemeRecoveryCopy(vfs, PARTNERS_PACKAGE_ID)).toBeUndefined();
    exportSite(container);
    expect(snapshots[0]!.pages[0]!.blocks[1]).toEqual(PARTNERS_BLOCK);
  });

  test("confirming adapts every Block, keeps a recovery copy, and the copy can be restored", async () => {
    const vfs = await vfsWithPartnersPackage();
    const snapshots: Site[] = [];
    const { container } = render(
      <EditorApp
        initial={siteWithPartners()}
        initialAssetVfs={vfs}
        onExport={(s) => snapshots.push(s)}
      />,
    );
    await packagesLoaded(container);
    await importPackage(container, packageZip({ version: "2.0.0", declaration: V2 }));
    const dialog = await waitFor(() => q(container, '[data-testid="package-update-dialog"]'));
    fireEvent.click(q(dialog, '[data-testid="package-update-confirm"]'));
    await waitFor(() => {
      if (container.querySelector("[data-theme-package-version]")?.textContent !== "v2.0.0") {
        throw new Error("not updated yet");
      }
    });

    // The Block followed: version 2, layout gone, everything else kept.
    exportSite(container);
    const updated = snapshots[0]!.pages[0]!.blocks[1]!;
    expect(updated.version).toBe(2);
    expect(updated.data).toEqual({
      heading: "Our partners",
      groups: [{ heading: "Gold", partners: [{ name: "Alpha" }] }],
    });

    // The recovery copy holds the outgoing package and the pre-update Block.
    const copy = await readThemeRecoveryCopy(vfs, PARTNERS_PACKAGE_ID);
    expect(copy?.version).toBe("1.0.0");
    expect(copy?.blocks.get("blk_partners")).toEqual(PARTNERS_BLOCK);

    // Restore puts both back.
    openSection(container, "theme");
    const restore = await waitFor(() =>
      q<HTMLButtonElement>(container, '[data-testid="theme-package-restore"]'),
    );
    expect(restore.textContent).toBe("Restore previous version (1.0.0)");
    fireEvent.click(restore);
    await waitFor(() => {
      if (container.querySelector("[data-theme-package-version]")?.textContent !== "v1.0.0") {
        throw new Error("not restored yet");
      }
    });
    expect(container.querySelector('[data-testid="theme-package-restore"]')).toBeNull();
    expect(await readThemeRecoveryCopy(vfs, PARTNERS_PACKAGE_ID)).toBeUndefined();
    exportSite(container);
    expect(snapshots[1]!.pages[0]!.blocks[1]).toEqual(PARTNERS_BLOCK);
  });

  test("a second package declaring a type another package already provides adapts nothing", async () => {
    // `org.a.decl` sorts before `org.example.declaring`, so it stays the
    // provider (ADR 0055); the incoming declaration at version 5 must not
    // stamp the Block, which would make it data-newer under the real one.
    const vfs = await vfsWithPartnersPackage({ id: "org.a.decl" });
    const snapshots: Site[] = [];
    const { container } = render(
      <EditorApp
        initial={siteWithPartners()}
        initialAssetVfs={vfs}
        onExport={(s) => snapshots.push(s)}
      />,
    );
    await packagesLoaded(container, "org.a.decl");
    await importPackage(
      container,
      packageZip({ version: "5.0.0", declaration: { ...PARTNERS_DECLARATION, version: 5 } }),
    );
    await waitFor(() => {
      if (
        container.querySelector(`[data-theme-package][data-theme-id="${PARTNERS_PACKAGE_ID}"]`) ===
        null
      ) {
        throw new Error("not installed yet");
      }
    });
    expect(container.querySelector('[data-testid="package-update-dialog"]')).toBeNull();
    openPage(container, 0);
    expect(container.querySelector('[data-testid="block-row-unavailable"]')).toBeNull();
    exportSite(container);
    expect(snapshots[0]!.pages[0]!.blocks[1]).toEqual(PARTNERS_BLOCK);
  });

  test.each([1, 2])(
    "a new winning provider preserves foreign envelopes at data version %i",
    async (dataVersion) => {
      const site = siteWithPartners();
      site.pages[0]!.blocks[1]!.version = dataVersion;
      const snapshots: Site[] = [];
      const { container } = render(
        <EditorApp
          initial={site}
          initialAssetVfs={await vfsWithPartnersPackage()}
          onExport={(s) => snapshots.push(s)}
        />,
      );
      await packagesLoaded(container);
      await importPackage(
        container,
        packageZip({
          id: "org.a.decl",
          version: "5.0.0",
          declaration: { ...V2, version: 5 },
        }),
      );
      await packagesLoaded(container, "org.a.decl");
      expect(container.querySelector('[data-testid="package-update-dialog"]')).toBeNull();
      fireEvent.click(q(container, 'button[data-action="save"]'));
      expect(snapshots[0]!.pages[0]!.blocks[1]).toEqual(site.pages[0]!.blocks[1]);
    },
  );

  test("a failed package installation retains the earlier recovery point and current data", async () => {
    const vfs = await vfsWithPartnersPackage({ version: "2.0.0", declaration: V2 });
    await saveThemeRecoveryCopy(vfs, loadThemePackage(partnersPackageFiles()), [PARTNERS_BLOCK]);
    const site = siteWithPartners();
    site.pages[0]!.blocks[1]!.version = 2;
    delete site.pages[0]!.blocks[1]!.data["layout"];
    const snapshots: Site[] = [];
    const { container } = render(
      <EditorApp initial={site} initialAssetVfs={vfs} onExport={(s) => snapshots.push(s)} />,
    );
    await packagesLoaded(container);
    const write = vfs.write.bind(vfs);
    let failed = false;
    const fault = vi.spyOn(vfs, "write").mockImplementation(async (path, bytes) => {
      if (!failed && path === `themes/${PARTNERS_PACKAGE_ID}/theme.json`) {
        failed = true;
        throw new Error("package write failed");
      }
      await write(path, bytes);
    });
    await importPackage(
      container,
      packageZip({ version: "3.0.0", declaration: { ...V2, version: 3 } }),
    );
    await waitFor(() => {
      expect(q(container, '[data-testid="theme-import-error"]').textContent).toContain(
        "package write failed",
      );
    });
    fault.mockRestore();
    const copy = await readThemeRecoveryCopy(vfs, PARTNERS_PACKAGE_ID);
    expect(copy?.version).toBe("1.0.0");
    expect(copy?.blocks.get(PARTNERS_BLOCK.id)).toEqual(PARTNERS_BLOCK);
    const manifest = JSON.parse(
      new TextDecoder().decode(await vfs.read(`themes/${PARTNERS_PACKAGE_ID}/theme.json`)),
    );
    expect(manifest.version).toBe("2.0.0");
    fireEvent.click(q(container, 'button[data-action="save"]'));
    expect(snapshots[0]!.pages[0]!.blocks[1]).toEqual(site.pages[0]!.blocks[1]);
  });

  test("an appearance-only update never asks and touches no Block", async () => {
    const vfs = await vfsWithPartnersPackage();
    const snapshots: Site[] = [];
    const { container } = render(
      <EditorApp
        initial={siteWithPartners()}
        initialAssetVfs={vfs}
        onExport={(s) => snapshots.push(s)}
      />,
    );
    await packagesLoaded(container);
    await importPackage(container, packageZip({ version: "1.1.0" }));
    await waitFor(() => {
      if (container.querySelector("[data-theme-package-version]")?.textContent !== "v1.1.0") {
        throw new Error("not updated yet");
      }
    });
    expect(container.querySelector('[data-testid="package-update-dialog"]')).toBeNull();
    exportSite(container);
    expect(snapshots[0]!.pages[0]!.blocks[1]).toEqual(PARTNERS_BLOCK);
  });
});
