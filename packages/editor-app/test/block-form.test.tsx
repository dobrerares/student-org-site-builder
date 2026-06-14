// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/preact";
import type { ZodType } from "zod";
import type {
  AssetRefLike,
  DocumentAssetRef,
  DocumentDownloadsData,
  ImageGalleryData,
  ValueListData,
} from "@sosb/schema";
import {
  ActivitiesListDataSchema,
  CtaBannerDataSchema,
  DocumentDownloadsDataSchema,
  HeroDataSchema,
  ImageGalleryDataSchema,
  PartnerLogosDataSchema,
  TeamGridDataSchema,
  ValueListDataSchema,
} from "@sosb/schema";

import { BlockForm } from "../src/block-form.js";
import { BLOCK_FIELD_METADATA, type FieldOverride } from "../src/field-metadata.js";

/**
 * BlockForm + valueList: the AC for issue #10 says "editor form supports
 * adding, removing, reordering items". This is the test surface.
 *
 * The component is generic over block data; we drive it here against the
 * `ValueListDataSchema` because that's the first block to need it. Other
 * blocks (#11-#22) plug in by passing a different schema and `newItem`
 * factory.
 */

interface Harness {
  data: ValueListData;
  patches: { path: readonly (string | number)[]; value: unknown }[];
  arrayChanges: { path: readonly (string | number)[]; next: unknown[] }[];
}

function makeHarness(initial: ValueListData): Harness {
  return { data: initial, patches: [], arrayChanges: [] };
}

function newValueListItem(): unknown {
  return { label: "New value" };
}

/**
 * Mock uploader for tests that don't exercise the upload path. The BlockForm
 * now requires an `uploader` prop (consumed by any mounted `<AssetPicker>`).
 * Tests that don't render an asset-bearing schema still need to satisfy the
 * type; this fake never resolves to anything useful but never fires either.
 */
function noopUploader(): Promise<AssetRefLike> {
  return Promise.reject(new Error("uploader not expected to fire in this test"));
}

/**
 * Document-upload counterpart to `noopUploader`. BlockForm also requires
 * a `documentUploader` prop (consumed by any mounted `<DocumentPicker>`);
 * tests that don't render a document-bearing schema still need to
 * satisfy the type. Same rejection posture as the image stub.
 */
function noopDocumentUploader(): Promise<DocumentAssetRef> {
  return Promise.reject(new Error("documentUploader not expected to fire in this test"));
}

describe("BlockForm — valueList items add/remove/reorder", () => {
  afterEach(cleanup);

  test("renders friendly labels from field metadata instead of raw field names", () => {
    const harness = makeHarness({
      items: [{ label: "First" }],
      layout: "grid",
      columns: 3,
    });

    const { container } = render(
      <BlockForm
        schema={ValueListDataSchema}
        data={harness.data}
        onPatch={(path, value) => harness.patches.push({ path, value })}
        onArrayChange={(path, next) => harness.arrayChanges.push({ path, next })}
        newItem={newValueListItem}
        uploader={noopUploader}
        documentUploader={noopDocumentUploader}
        overrides={[{ path: "columns", label: "Number of columns" }]}
      />,
    );

    const label = container.querySelector('[data-field-label="columns"] span');
    expect(label?.textContent).toBe("Number of columns");
  });

  test("renders one fieldset per item with controls", () => {
    const harness = makeHarness({
      items: [
        { label: "First", icon: "users" },
        { label: "Second" },
        { label: "Third", description: "trio" },
      ],
      layout: "grid",
      columns: 3,
    });

    const { container } = render(
      <BlockForm
        schema={ValueListDataSchema}
        data={harness.data}
        onPatch={(path, value) => harness.patches.push({ path, value })}
        onArrayChange={(path, next) => harness.arrayChanges.push({ path, next })}
        newItem={newValueListItem}
        uploader={noopUploader}
        documentUploader={noopDocumentUploader}
      />,
    );

    const items = container.querySelectorAll('[data-testid="items__item"]');
    expect(items.length).toBe(3);
  });

  test("clicking 'Add item' appends a new item to the items array", () => {
    const harness = makeHarness({
      items: [{ label: "Only one" }],
      layout: "grid",
      columns: 3,
    });

    const { container } = render(
      <BlockForm
        schema={ValueListDataSchema}
        data={harness.data}
        onPatch={(path, value) => harness.patches.push({ path, value })}
        onArrayChange={(path, next) => harness.arrayChanges.push({ path, next })}
        newItem={newValueListItem}
        uploader={noopUploader}
        documentUploader={noopDocumentUploader}
      />,
    );

    // The items array fieldset has its own add button.
    const itemsFieldset = container.querySelector('fieldset[data-field="items"]');
    expect(itemsFieldset).not.toBeNull();
    const addButton = itemsFieldset!.querySelector<HTMLButtonElement>('button[data-action="add"]');
    expect(addButton).not.toBeNull();

    fireEvent.click(addButton!);

    expect(harness.arrayChanges.length).toBe(1);
    expect(harness.arrayChanges[0]!.path).toEqual(["items"]);
    const next = harness.arrayChanges[0]!.next;
    expect(next.length).toBe(2);
    expect((next[1] as { label: string }).label).toBe("New value");
  });

  test("clicking 'Remove' on an item drops it from the array", () => {
    const harness = makeHarness({
      items: [{ label: "Keep me" }, { label: "Drop me" }, { label: "Keep me too" }],
      layout: "grid",
      columns: 3,
    });

    const { container } = render(
      <BlockForm
        schema={ValueListDataSchema}
        data={harness.data}
        onPatch={(path, value) => harness.patches.push({ path, value })}
        onArrayChange={(path, next) => harness.arrayChanges.push({ path, next })}
        newItem={newValueListItem}
        uploader={noopUploader}
        documentUploader={noopDocumentUploader}
      />,
    );

    const middleItem = container.querySelectorAll('[data-testid="items__item"]')[1] as HTMLElement;
    const removeButton = middleItem.querySelector<HTMLButtonElement>(
      'button[data-action="remove"]',
    );
    fireEvent.click(removeButton!);

    expect(harness.arrayChanges.length).toBe(1);
    const next = harness.arrayChanges[0]!.next as { label: string }[];
    expect(next.map((i) => i.label)).toEqual(["Keep me", "Keep me too"]);
  });

  test("'Move up' on the second item swaps it with the first", () => {
    const harness = makeHarness({
      items: [{ label: "A" }, { label: "B" }, { label: "C" }],
      layout: "grid",
      columns: 3,
    });

    const { container } = render(
      <BlockForm
        schema={ValueListDataSchema}
        data={harness.data}
        onPatch={(path, value) => harness.patches.push({ path, value })}
        onArrayChange={(path, next) => harness.arrayChanges.push({ path, next })}
        newItem={newValueListItem}
        uploader={noopUploader}
        documentUploader={noopDocumentUploader}
      />,
    );

    const second = container.querySelectorAll('[data-testid="items__item"]')[1] as HTMLElement;
    const moveUp = second.querySelector<HTMLButtonElement>('button[data-action="move-up"]');
    fireEvent.click(moveUp!);

    expect(harness.arrayChanges.length).toBe(1);
    const next = harness.arrayChanges[0]!.next as { label: string }[];
    expect(next.map((i) => i.label)).toEqual(["B", "A", "C"]);
  });

  test("'Move down' on the first item swaps it with the second", () => {
    const harness = makeHarness({
      items: [{ label: "A" }, { label: "B" }],
      layout: "grid",
      columns: 3,
    });

    const { container } = render(
      <BlockForm
        schema={ValueListDataSchema}
        data={harness.data}
        onPatch={(path, value) => harness.patches.push({ path, value })}
        onArrayChange={(path, next) => harness.arrayChanges.push({ path, next })}
        newItem={newValueListItem}
        uploader={noopUploader}
        documentUploader={noopDocumentUploader}
      />,
    );

    const first = container.querySelectorAll('[data-testid="items__item"]')[0] as HTMLElement;
    const moveDown = first.querySelector<HTMLButtonElement>('button[data-action="move-down"]');
    fireEvent.click(moveDown!);

    const next = harness.arrayChanges[0]!.next as { label: string }[];
    expect(next.map((i) => i.label)).toEqual(["B", "A"]);
  });

  test("'Move up' on the first item is disabled", () => {
    const harness = makeHarness({
      items: [{ label: "Only" }, { label: "Two" }],
      layout: "grid",
      columns: 3,
    });

    const { container } = render(
      <BlockForm
        schema={ValueListDataSchema}
        data={harness.data}
        onPatch={(path, value) => harness.patches.push({ path, value })}
        onArrayChange={(path, next) => harness.arrayChanges.push({ path, next })}
        newItem={newValueListItem}
        uploader={noopUploader}
        documentUploader={noopDocumentUploader}
      />,
    );

    const first = container.querySelectorAll('[data-testid="items__item"]')[0] as HTMLElement;
    const moveUp = first.querySelector<HTMLButtonElement>('button[data-action="move-up"]');
    expect(moveUp!.disabled).toBe(true);
  });

  test("'Move down' on the last item is disabled", () => {
    const harness = makeHarness({
      items: [{ label: "First" }, { label: "Last" }],
      layout: "grid",
      columns: 3,
    });

    const { container } = render(
      <BlockForm
        schema={ValueListDataSchema}
        data={harness.data}
        onPatch={(path, value) => harness.patches.push({ path, value })}
        onArrayChange={(path, next) => harness.arrayChanges.push({ path, next })}
        newItem={newValueListItem}
        uploader={noopUploader}
        documentUploader={noopDocumentUploader}
      />,
    );

    const items = container.querySelectorAll('[data-testid="items__item"]');
    const last = items[items.length - 1] as HTMLElement;
    const moveDown = last.querySelector<HTMLButtonElement>('button[data-action="move-down"]');
    expect(moveDown!.disabled).toBe(true);
  });

  test("editing an item's label fires onPatch with an indexed path", () => {
    const harness = makeHarness({
      items: [{ label: "Old" }, { label: "Other" }],
      layout: "grid",
      columns: 3,
    });

    const { container } = render(
      <BlockForm
        schema={ValueListDataSchema}
        data={harness.data}
        onPatch={(path, value) => harness.patches.push({ path, value })}
        onArrayChange={(path, next) => harness.arrayChanges.push({ path, next })}
        newItem={newValueListItem}
        uploader={noopUploader}
        documentUploader={noopDocumentUploader}
      />,
    );

    // The first item's label input has a path of `items.0.label`.
    const labelInput = container.querySelector<HTMLInputElement>('[data-field="items.0.label"]');
    expect(labelInput).not.toBeNull();
    fireEvent.input(labelInput!, { target: { value: "New label" } });

    expect(harness.patches.length).toBe(1);
    expect(harness.patches[0]!.path).toEqual(["items", 0, "label"]);
    expect(harness.patches[0]!.value).toBe("New label");
  });

  test("layout enum surfaces all schema options", () => {
    const harness = makeHarness({
      items: [{ label: "x" }],
      layout: "grid",
      columns: 3,
    });

    const { container } = render(
      <BlockForm
        schema={ValueListDataSchema}
        data={harness.data}
        onPatch={(path, value) => harness.patches.push({ path, value })}
        onArrayChange={(path, next) => harness.arrayChanges.push({ path, next })}
        newItem={newValueListItem}
        uploader={noopUploader}
        documentUploader={noopDocumentUploader}
      />,
    );

    const layoutSelect = container.querySelector<HTMLSelectElement>('[data-field="layout"]');
    expect(layoutSelect).not.toBeNull();
    const options = Array.from(layoutSelect!.querySelectorAll("option")).map((o) => o.value);
    expect(options).toContain("grid");
    expect(options).toContain("list");
  });

  test("icon enum on an item exposes the curated lucide subset", () => {
    const harness = makeHarness({
      items: [{ label: "Iconed" }],
      layout: "grid",
      columns: 3,
    });

    const { container } = render(
      <BlockForm
        schema={ValueListDataSchema}
        data={harness.data}
        onPatch={(path, value) => harness.patches.push({ path, value })}
        onArrayChange={(path, next) => harness.arrayChanges.push({ path, next })}
        newItem={newValueListItem}
        uploader={noopUploader}
        documentUploader={noopDocumentUploader}
      />,
    );

    // The first item's icon select has path items.0.icon.
    const iconSelect = container.querySelector<HTMLSelectElement>('[data-field="items.0.icon"]');
    expect(iconSelect).not.toBeNull();
    const optionValues = Array.from(iconSelect!.querySelectorAll("option")).map((o) => o.value);
    // It's an optional enum, so the empty "(unset)" option must be there.
    expect(optionValues).toContain("");
    expect(optionValues).toContain("users");
    expect(optionValues).toContain("lightbulb");
  });
});

/**
 * BlockForm + imageGallery: schema-identity dispatch (ADR 0043, T11).
 *
 * The form-generator's schema-identity registry pairs `AssetRefSchema` with
 * the "asset-picker" renderer. When BlockForm walks an ImageGallery's data
 * schema, every `images.[k].asset` slot must be rendered by `<AssetPicker>`
 * — NOT by a hash/path/mime/etc. text-input fieldset. This describe block
 * locks in:
 *  - one AssetPicker mounts per image entry,
 *  - none of the AssetRef structural leaves (hash, mime, path, metadataPath)
 *    surface as `<input>` controls anywhere in the form (ADR 0044).
 */
function makeGalleryAsset(suffix: string): AssetRefLike {
  return {
    hash: `hash-${suffix}`,
    path: `assets/${suffix}.jpg`,
    metadataPath: `assets/${suffix}.metadata.json`,
    mime: "image/jpeg",
    width: 800,
    height: 600,
    alt: `Sample ${suffix}`,
  };
}

describe("BlockForm — imageGallery wires AssetPicker per image (ADR 0043, T11)", () => {
  afterEach(cleanup);

  function makeGalleryHarness(): ImageGalleryData {
    return {
      title: "Gallery",
      layout: "grid",
      columns: 3,
      lightbox: true,
      images: [
        { asset: makeGalleryAsset("one"), alt: "First photo" },
        { asset: makeGalleryAsset("two"), alt: "Second photo" },
      ],
    };
  }

  test("mounts one AssetPicker per gallery image", () => {
    const uploader = vi.fn<(file: File) => Promise<AssetRefLike>>();
    const data = makeGalleryHarness();
    const { container } = render(
      <BlockForm
        schema={ImageGalleryDataSchema}
        data={data}
        onPatch={() => {}}
        onArrayChange={() => {}}
        uploader={uploader}
        documentUploader={noopDocumentUploader}
      />,
    );
    const pickers = container.querySelectorAll('[data-testid="asset-picker"]');
    expect(pickers.length).toBe(data.images.length);
  });

  test("does NOT render hash / mime / path / metadataPath text inputs anywhere", () => {
    const uploader = vi.fn<(file: File) => Promise<AssetRefLike>>();
    const { container } = render(
      <BlockForm
        schema={ImageGalleryDataSchema}
        data={makeGalleryHarness()}
        onPatch={() => {}}
        onArrayChange={() => {}}
        uploader={uploader}
        documentUploader={noopDocumentUploader}
      />,
    );
    // The renderer emits `[data-field="..."]` on every input it owns;
    // checking each banned leaf catches both nested object recursion and
    // a path-keyed re-introduction.
    for (const leaf of ["hash", "mime", "path", "metadataPath", "width", "height"]) {
      // No `<input>`/`<select>` whose data-field ends in `.<leaf>` or equals
      // exactly the leaf name. The AssetRef structural leaves would surface
      // here if the schema-identity dispatch were bypassed.
      const matches = Array.from(container.querySelectorAll<HTMLElement>(`[data-field]`)).filter(
        (el) => {
          const path = el.getAttribute("data-field") ?? "";
          const last = path.split(".").pop();
          return last === leaf;
        },
      );
      expect(matches, `expected no <input> for AssetRef.${leaf}`).toEqual([]);
    }
  });

  test("each AssetPicker reads the AssetRef at its own indexed path", () => {
    // Reference-equality short-circuit: confirm both pickers actually point
    // at the right image's asset by inspecting the rendered thumbnail's src
    // — getAtPath(data, ["images", k, "asset"]).path round-trips through to
    // the <img>'s src attribute. If the indexing were wrong (e.g. both
    // pickers reading [0]), both thumbnails would point at the same file.
    const uploader = vi.fn<(file: File) => Promise<AssetRefLike>>();
    const data = makeGalleryHarness();
    const { container } = render(
      <BlockForm
        schema={ImageGalleryDataSchema}
        data={data}
        onPatch={() => {}}
        onArrayChange={() => {}}
        uploader={uploader}
        documentUploader={noopDocumentUploader}
      />,
    );

    const thumbnails = container.querySelectorAll<HTMLImageElement>(
      '[data-testid="asset-picker-thumbnail"]',
    );
    expect(thumbnails.length).toBe(2);
    expect(thumbnails[0]!.getAttribute("src")).toBe("assets/one.jpg");
    expect(thumbnails[1]!.getAttribute("src")).toBe("assets/two.jpg");
  });

  test("AssetPicker.onChange routes through onPatch with the indexed AssetRef path", async () => {
    // Upload-driven proof that the picker's onChange is wired through to
    // BlockForm's onPatch with the correct nested path. We pick the second
    // image so a 1-vs-0 indexing bug would be caught: with patches at
    // ["images", 1, "asset"] we know we're indexing by item, not by always
    // hitting slot 0.
    const uploaded: AssetRefLike = makeGalleryAsset("uploaded");
    const uploader = vi.fn().mockResolvedValue(uploaded);
    const patches: { path: readonly (string | number)[]; value: unknown }[] = [];
    const data = makeGalleryHarness();
    const { container } = render(
      <BlockForm
        schema={ImageGalleryDataSchema}
        data={data}
        onPatch={(path, value) => patches.push({ path, value })}
        onArrayChange={() => {}}
        uploader={uploader}
        documentUploader={noopDocumentUploader}
      />,
    );

    const pickers = container.querySelectorAll('[data-testid="asset-picker"]');
    const secondPicker = pickers[1] as HTMLElement;
    const fileInput = secondPicker.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toBeNull();

    const file = new File([new Uint8Array([0xff, 0xd8])], "uploaded.jpg", {
      type: "image/jpeg",
    });
    Object.defineProperty(fileInput, "files", { value: [file], configurable: true });
    fireEvent.change(fileInput);

    await Promise.resolve();
    await Promise.resolve();

    expect(uploader).toHaveBeenCalledTimes(1);
    expect(uploader).toHaveBeenCalledWith(file, "Second photo");
    expect(patches.length).toBe(2);
    expect(patches[0]!.path).toEqual(["images", 1, "asset"]);
    expect(patches[0]!.value).toEqual(uploaded);
    expect(patches[1]!.path).toEqual(["images", 1, "alt"]);
    expect(patches[1]!.value).toBe(uploaded.alt);
  });
});

/**
 * BlockForm + "Show advanced" toggle (ADR 0043, T16).
 *
 * The form holds a per-instance `showAdvanced` flag. Fields whose
 * metadata declares `tier: "advanced"` are hidden until the toggle is
 * on; `tier: "hidden"` fields are never rendered regardless of toggle
 * state. The toggle state is per-component-instance: mounting a second
 * BlockForm starts hidden again, with no module-level coupling.
 *
 * Tests drive the integration by injecting ad-hoc `overrides` (rather
 * than relying on the production `BLOCK_FIELD_METADATA`, which today
 * carries only `label` rewrites and no tier markers for block fields).
 */
describe("BlockForm — Show advanced toggle (ADR 0043, T16)", () => {
  afterEach(cleanup);

  function makeValueListData(): ValueListData {
    return {
      title: "Our values",
      intro: "Why we exist",
      items: [{ label: "Curiosity" }],
      layout: "grid",
      columns: 3,
    };
  }

  function clickAdvancedToggle(container: ParentNode): void {
    const checkbox = container.querySelector<HTMLInputElement>(
      '[data-testid="advanced-toggle"] input[type="checkbox"]',
    );
    expect(checkbox, "advanced toggle should be present in BlockForm").not.toBeNull();
    fireEvent.click(checkbox!);
  }

  test("hides tier=advanced fields by default (toggle off)", () => {
    const overrides: readonly FieldOverride[] = [{ path: "intro", tier: "advanced" }];
    const { container } = render(
      <BlockForm
        schema={ValueListDataSchema}
        data={makeValueListData()}
        onPatch={() => {}}
        onArrayChange={() => {}}
        newItem={newValueListItem}
        uploader={noopUploader}
        documentUploader={noopDocumentUploader}
        overrides={overrides}
      />,
    );

    // Default-tier fields stay visible.
    expect(container.querySelector('[data-field="title"]')).not.toBeNull();
    // Advanced field is hidden by default.
    expect(container.querySelector('[data-field="intro"]')).toBeNull();
  });

  test("reveals tier=advanced fields when the toggle is on", () => {
    const overrides: readonly FieldOverride[] = [{ path: "intro", tier: "advanced" }];
    const { container } = render(
      <BlockForm
        schema={ValueListDataSchema}
        data={makeValueListData()}
        onPatch={() => {}}
        onArrayChange={() => {}}
        newItem={newValueListItem}
        uploader={noopUploader}
        documentUploader={noopDocumentUploader}
        overrides={overrides}
      />,
    );

    expect(container.querySelector('[data-field="intro"]')).toBeNull();
    clickAdvancedToggle(container);
    expect(container.querySelector('[data-field="intro"]')).not.toBeNull();
  });

  test("never renders tier=hidden fields regardless of toggle state", () => {
    const overrides: readonly FieldOverride[] = [{ path: "intro", tier: "hidden" }];
    const { container } = render(
      <BlockForm
        schema={ValueListDataSchema}
        data={makeValueListData()}
        onPatch={() => {}}
        onArrayChange={() => {}}
        newItem={newValueListItem}
        uploader={noopUploader}
        documentUploader={noopDocumentUploader}
        overrides={overrides}
      />,
    );

    // Hidden with toggle off…
    expect(container.querySelector('[data-field="intro"]')).toBeNull();
    // …and still hidden with toggle on.
    clickAdvancedToggle(container);
    expect(container.querySelector('[data-field="intro"]')).toBeNull();
  });

  test("toggle state is per-instance (separate mounts have independent state)", () => {
    const overrides: readonly FieldOverride[] = [{ path: "intro", tier: "advanced" }];

    // Render two BlockForms side by side in separate Preact roots so each
    // mounts its own `useState` cell. If the toggle state leaked across
    // instances (e.g. module-level), flipping one would flip both.
    const first = render(
      <BlockForm
        schema={ValueListDataSchema}
        data={makeValueListData()}
        onPatch={() => {}}
        onArrayChange={() => {}}
        newItem={newValueListItem}
        uploader={noopUploader}
        documentUploader={noopDocumentUploader}
        overrides={overrides}
      />,
    );
    const second = render(
      <BlockForm
        schema={ValueListDataSchema}
        data={makeValueListData()}
        onPatch={() => {}}
        onArrayChange={() => {}}
        newItem={newValueListItem}
        uploader={noopUploader}
        documentUploader={noopDocumentUploader}
        overrides={overrides}
      />,
    );

    // Both start with the advanced field hidden.
    expect(first.container.querySelector('[data-field="intro"]')).toBeNull();
    expect(second.container.querySelector('[data-field="intro"]')).toBeNull();

    // Toggle the first form on. The second must stay off.
    clickAdvancedToggle(first.container);
    expect(first.container.querySelector('[data-field="intro"]')).not.toBeNull();
    expect(second.container.querySelector('[data-field="intro"]')).toBeNull();
  });
});

/**
 * BlockForm + documentDownloads wires DocumentPicker per file (ADR 0043, T18).
 *
 * Sibling to the imageGallery test block above: the form-generator's
 * schema-identity registry pairs `DocumentAssetRefSchema` with the
 * "document-picker" renderer. When BlockForm walks a documentDownloads
 * data schema, every `files.[k].asset` slot must be rendered by
 * `<DocumentPicker>` — NOT by a hash/path/mime/byteSize text-input
 * fieldset. This describe block locks in:
 *  - one DocumentPicker mounts per files entry,
 *  - none of the DocumentAssetRef structural leaves (hash, mime, path,
 *    metadataPath, byteSize) surface as `<input>` controls anywhere in
 *    the form (ADR 0044).
 */
function makeDocumentAsset(suffix: string): DocumentAssetRef {
  return {
    hash: `hash-${suffix}`,
    path: `assets/${suffix}.pdf`,
    metadataPath: `assets/${suffix}.metadata.json`,
    mime: "application/pdf",
    byteSize: 1024 * 128, // 128 KB
  };
}

describe("BlockForm — documentDownloads wires DocumentPicker per file (ADR 0043, T18)", () => {
  afterEach(cleanup);

  function makeDocumentsHarness(): DocumentDownloadsData {
    return {
      title: "Documents",
      layout: "list",
      files: [
        { asset: makeDocumentAsset("regulament"), label: "Regulament 2026" },
        { asset: makeDocumentAsset("statut"), label: "Statut" },
      ],
    };
  }

  test("mounts one DocumentPicker per files entry", () => {
    const documentUploader = vi.fn<(file: File) => Promise<DocumentAssetRef>>();
    const data = makeDocumentsHarness();
    const { container } = render(
      <BlockForm
        schema={DocumentDownloadsDataSchema}
        data={data}
        onPatch={() => {}}
        onArrayChange={() => {}}
        uploader={noopUploader}
        documentUploader={documentUploader}
      />,
    );
    const pickers = container.querySelectorAll('[data-testid="document-picker"]');
    expect(pickers.length).toBe(data.files.length);
  });

  test("does NOT render hash / mime / path / metadataPath / byteSize text inputs anywhere", () => {
    const documentUploader = vi.fn<(file: File) => Promise<DocumentAssetRef>>();
    const { container } = render(
      <BlockForm
        schema={DocumentDownloadsDataSchema}
        data={makeDocumentsHarness()}
        onPatch={() => {}}
        onArrayChange={() => {}}
        uploader={noopUploader}
        documentUploader={documentUploader}
      />,
    );
    // The renderer emits `[data-field="..."]` on every input it owns;
    // checking each banned leaf catches both nested object recursion
    // and a path-keyed re-introduction.
    for (const leaf of ["hash", "mime", "path", "metadataPath", "byteSize"]) {
      const matches = Array.from(container.querySelectorAll<HTMLElement>(`[data-field]`)).filter(
        (el) => {
          const path = el.getAttribute("data-field") ?? "";
          const last = path.split(".").pop();
          return last === leaf;
        },
      );
      expect(matches, `expected no <input> for DocumentAssetRef.${leaf}`).toEqual([]);
    }
  });

  test("each DocumentPicker reads the DocumentAssetRef at its own indexed path", () => {
    // The picker's filename derives from the value's `path` (last
    // segment); confirming both pickers show their own filename
    // catches a hypothetical 0-indexing bug where both pickers read
    // [0] (same as the imageGallery thumbnail-src check above).
    const documentUploader = vi.fn<(file: File) => Promise<DocumentAssetRef>>();
    const data = makeDocumentsHarness();
    const { container } = render(
      <BlockForm
        schema={DocumentDownloadsDataSchema}
        data={data}
        onPatch={() => {}}
        onArrayChange={() => {}}
        uploader={noopUploader}
        documentUploader={documentUploader}
      />,
    );

    const filenames = container.querySelectorAll<HTMLElement>(
      '[data-testid="document-picker-filename"]',
    );
    expect(filenames.length).toBe(2);
    expect(filenames[0]!.textContent).toBe("regulament.pdf");
    expect(filenames[1]!.textContent).toBe("statut.pdf");
  });

  test("DocumentPicker.onChange routes through onPatch with the indexed DocumentAssetRef path", async () => {
    // Upload-driven proof: the picker's onChange wires through to
    // BlockForm's onPatch with the correct nested path. Picking the
    // second file ensures a 1-vs-0 indexing bug would be caught.
    const uploaded: DocumentAssetRef = makeDocumentAsset("uploaded");
    const documentUploader = vi.fn().mockResolvedValue(uploaded);
    const patches: { path: readonly (string | number)[]; value: unknown }[] = [];
    const data = makeDocumentsHarness();
    const { container } = render(
      <BlockForm
        schema={DocumentDownloadsDataSchema}
        data={data}
        onPatch={(path, value) => patches.push({ path, value })}
        onArrayChange={() => {}}
        uploader={noopUploader}
        documentUploader={documentUploader}
      />,
    );

    const pickers = container.querySelectorAll('[data-testid="document-picker"]');
    const secondPicker = pickers[1] as HTMLElement;
    const fileInput = secondPicker.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toBeNull();

    const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "uploaded.pdf", {
      type: "application/pdf",
    });
    Object.defineProperty(fileInput, "files", { value: [file], configurable: true });
    fireEvent.change(fileInput);

    await Promise.resolve();
    await Promise.resolve();

    expect(documentUploader).toHaveBeenCalledTimes(1);
    expect(documentUploader).toHaveBeenCalledWith(file);
    expect(patches.length).toBe(1);
    expect(patches[0]!.path).toEqual(["files", 1, "asset"]);
    expect(patches[0]!.value).toEqual(uploaded);
  });

  test("uploading into a new empty file row fills the label from the uploaded filename", async () => {
    const uploaded: DocumentAssetRef = {
      ...makeDocumentAsset("uploaded"),
      originalName: "uploaded-report.pdf",
    };
    const documentUploader = vi.fn().mockResolvedValue(uploaded);
    const patches: { path: readonly (string | number)[]; value: unknown }[] = [];
    const data = {
      title: "Documents",
      layout: "list",
      files: [{}],
    } as unknown as DocumentDownloadsData;
    const { container } = render(
      <BlockForm
        schema={DocumentDownloadsDataSchema}
        data={data}
        onPatch={(path, value) => patches.push({ path, value })}
        onArrayChange={() => {}}
        uploader={noopUploader}
        documentUploader={documentUploader}
      />,
    );

    const fileInput = container.querySelector<HTMLInputElement>(
      '[data-testid="document-picker-file-input"]',
    );
    expect(fileInput).not.toBeNull();
    const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "uploaded-report.pdf", {
      type: "application/pdf",
    });
    Object.defineProperty(fileInput!, "files", { value: [file], configurable: true });
    fireEvent.change(fileInput!);

    await Promise.resolve();
    await Promise.resolve();

    expect(patches.map((patch) => patch.path)).toEqual([
      ["files", 0, "asset"],
      ["files", 0, "label"],
    ]);
    expect(patches[1]!.value).toBe("uploaded-report.pdf");
  });
});

/**
 * Structural guard for the schema-identity dispatch (ADR 0044 done-criterion
 * #1): for every block type whose data schema embeds an AssetRef-shaped
 * sub-schema, BlockForm MUST mount the asset-picker / document-picker
 * widget instead of recursing into the structural leaves
 * (hash/path/metadataPath/mime/width/height/byteSize).
 *
 * Three AssetRef-shaped sub-schemas were initially missed by the dispatch
 * map (ctaBanner's `CtaBannerAssetRefSchema`, teamGrid's
 * `PersonPhotoSchema`, activitiesList's `ActivityImageRefSchema`) because
 * they are reference-distinct from the canonical `AssetRefSchema` —
 * intentionally so, since each tunes `alt`/`mime` strictness to its
 * block's tolerance for stale data (see asset-ref.ts's "Distinct shapes"
 * docblock). The earlier reviewer's recommendation was to ship a guard
 * that iterates EVERY asset-bearing block so a future addition can't
 * silently regress. That guard lives here.
 *
 * The list MUST include every block type whose data schema embeds an
 * AssetRef-shaped sub-schema. Adding a new such block requires (a) a
 * dispatch entry in `block-form.tsx`'s `MEDIA_PICKER_RENDERERS` and (b)
 * a row here.
 */
describe("BlockForm — asset-picker dispatch covers every AssetRef-bearing block (ADR 0044)", () => {
  afterEach(cleanup);

  /**
   * Structural leaves that the default object walker would emit as raw
   * `<input>` controls if the schema-identity dispatch missed. Each of
   * these has an `<input type="text" data-field="…">` (or `type="number"`
   * for the numeric ones) in the failure mode — checking for any
   * `data-field` whose last segment matches catches the regression
   * whether it surfaces at the top level (`hash`) or deep inside an
   * array item (`partners.0.logo.hash`).
   *
   * `byteSize` is DocumentAssetRef-specific; the rest live on image
   * AssetRefs. The combined set covers both pickers in one sweep.
   */
  const ASSET_LEAF_FIELDS = [
    "hash",
    "path",
    "metadataPath",
    "mime",
    "width",
    "height",
    "byteSize",
  ] as const;

  function makeImageAsset(suffix: string): AssetRefLike {
    return {
      hash: `hash-${suffix}`,
      path: `assets/${suffix}.jpg`,
      metadataPath: `assets/${suffix}.metadata.json`,
      mime: "image/jpeg",
      width: 800,
      height: 600,
      alt: `Sample ${suffix}`,
    };
  }

  function makeDocAsset(suffix: string): DocumentAssetRef {
    return {
      hash: `hash-${suffix}`,
      path: `assets/${suffix}.pdf`,
      metadataPath: `assets/${suffix}.metadata.json`,
      mime: "application/pdf",
      byteSize: 1024,
    };
  }

  interface BlockCase {
    readonly type: string;
    readonly schema: ZodType;
    readonly data: unknown;
  }

  /**
   * One row per asset-bearing block type. `data` must satisfy the
   * matching schema (so the form renders without hitting an unparseable
   * branch) AND must POPULATE every AssetRef slot — an unpopulated
   * optional slot is fine for dispatch purposes (the picker still
   * mounts) but populating one yields a strictly more rigorous test:
   * the underlying `value` is the AssetRef object, and a regression to
   * the default-object walker would surface its leaves with concrete
   * (non-empty) values.
   */
  const cases: readonly BlockCase[] = [
    {
      type: "imageGallery",
      schema: ImageGalleryDataSchema,
      data: {
        title: "Gallery",
        layout: "grid",
        columns: 3,
        lightbox: true,
        images: [{ asset: makeImageAsset("ig"), alt: "First photo" }],
      },
    },
    {
      type: "partnerLogos",
      schema: PartnerLogosDataSchema,
      data: {
        title: "Partners",
        partners: [{ name: "Partner A", logo: makeImageAsset("pl") }],
      },
    },
    {
      type: "documentDownloads",
      schema: DocumentDownloadsDataSchema,
      data: {
        title: "Documents",
        layout: "list",
        files: [{ asset: makeDocAsset("dd"), label: "Regulament" }],
      },
    },
    {
      type: "ctaBanner",
      schema: CtaBannerDataSchema,
      data: {
        title: "Call to action",
        subtitle: "Supporting copy.",
        button: { label: "Go", url: "/", style: "primary" },
        backgroundImage: makeImageAsset("cb"),
      },
    },
    {
      type: "teamGrid",
      schema: TeamGridDataSchema,
      data: {
        title: "Team",
        columns: 3,
        people: [{ name: "Person", role: "Role", photo: makeImageAsset("tg") }],
      },
    },
    {
      type: "activitiesList",
      schema: ActivitiesListDataSchema,
      data: {
        title: "Activities",
        layout: "cards",
        items: [{ title: "Activity", image: makeImageAsset("al") }],
      },
    },
  ];

  for (const blockCase of cases) {
    test(`${blockCase.type}: no raw inputs for AssetRef structural leaves`, () => {
      const { container } = render(
        <BlockForm
          schema={blockCase.schema}
          data={blockCase.data}
          onPatch={() => {}}
          onArrayChange={() => {}}
          uploader={noopUploader}
          documentUploader={noopDocumentUploader}
        />,
      );

      // The renderer emits `[data-field="..."]` on every `<input>`/
      // `<select>` it owns. The path is dotted, so the last segment is
      // the leaf name. If the schema-identity dispatch missed, every
      // structural leaf would have its own input here. Checking the
      // suffix catches both top-level slots (`backgroundImage.hash`)
      // and nested-in-array slots (`partners.0.logo.hash`).
      for (const leaf of ASSET_LEAF_FIELDS) {
        const matches = Array.from(container.querySelectorAll<HTMLElement>("[data-field]")).filter(
          (el) => {
            const path = el.getAttribute("data-field") ?? "";
            const last = path.split(".").pop();
            return last === leaf;
          },
        );
        expect(
          matches,
          `${blockCase.type} surfaced a raw input for AssetRef leaf "${leaf}" (schema-identity dispatch missed?)`,
        ).toEqual([]);
      }
    });

    test(`${blockCase.type}: at least one asset/document picker mounts`, () => {
      const { container } = render(
        <BlockForm
          schema={blockCase.schema}
          data={blockCase.data}
          onPatch={() => {}}
          onArrayChange={() => {}}
          uploader={noopUploader}
          documentUploader={noopDocumentUploader}
        />,
      );
      const assetPickers = container.querySelectorAll('[data-testid="asset-picker"]');
      const docPickers = container.querySelectorAll('[data-testid="document-picker"]');
      // documentDownloads dispatches to document-picker; the rest go to
      // asset-picker. Either count satisfies the "a media picker mounts"
      // assertion — what we're really catching is the case where NO
      // picker mounted because the dispatch missed and the form
      // recursed into the structural leaves instead.
      expect(
        assetPickers.length + docPickers.length,
        `${blockCase.type} should mount at least one media picker`,
      ).toBeGreaterThan(0);
    });
  }
});

/**
 * BlockForm + advisory length hints (Guardrail 1).
 *
 * Hero title/subtitle carry a `hint` in `BLOCK_FIELD_METADATA`. The form
 * must render that hint as muted helper text beneath the field — soft
 * guidance only. The test drives the production metadata (not an ad-hoc
 * override) so it also proves the metadata → form-generator → renderer
 * wiring end to end. Crucially, the hint must NOT block or alter input:
 * editing the title still fires onPatch with the typed value verbatim.
 */
describe("BlockForm — advisory length hints (Guardrail 1)", () => {
  afterEach(cleanup);

  test("renders the hero title/subtitle hints as muted helper text", () => {
    const { container } = render(
      <BlockForm
        schema={HeroDataSchema}
        data={{ title: "Welcome", subtitle: "Intro copy" }}
        onPatch={() => {}}
        onArrayChange={() => {}}
        uploader={noopUploader}
        documentUploader={noopDocumentUploader}
        overrides={BLOCK_FIELD_METADATA.hero!}
      />,
    );

    const hints = Array.from(
      container.querySelectorAll<HTMLElement>('[data-testid="field-hint"]'),
    ).map((el) => el.textContent);
    expect(hints).toContain("Aim for ~60 characters — short and punchy reads best.");
    expect(hints).toContain("~140 characters keeps the intro scannable.");
  });

  test("the hint is advisory only — typing an over-length title still patches verbatim", () => {
    const patches: { path: readonly (string | number)[]; value: unknown }[] = [];
    const { container } = render(
      <BlockForm
        schema={HeroDataSchema}
        data={{ title: "Welcome" }}
        onPatch={(path, value) => patches.push({ path, value })}
        onArrayChange={() => {}}
        uploader={noopUploader}
        documentUploader={noopDocumentUploader}
        overrides={BLOCK_FIELD_METADATA.hero!}
      />,
    );

    const titleInput = container.querySelector<HTMLInputElement>('[data-field="title"]');
    expect(titleInput).not.toBeNull();
    // Well past the ~60-char advisory length — must pass through unchanged.
    const longTitle = "x".repeat(200);
    fireEvent.input(titleInput!, { target: { value: longTitle } });
    expect(patches.length).toBe(1);
    expect(patches[0]!.path).toEqual(["title"]);
    expect(patches[0]!.value).toBe(longTitle);
  });

  test("fields without a hint render no helper text", () => {
    const { container } = render(
      <BlockForm
        schema={HeroDataSchema}
        data={{ title: "Welcome" }}
        onPatch={() => {}}
        onArrayChange={() => {}}
        uploader={noopUploader}
        documentUploader={noopDocumentUploader}
        // No overrides: no field carries a hint.
      />,
    );
    expect(container.querySelector('[data-testid="field-hint"]')).toBeNull();
  });
});
