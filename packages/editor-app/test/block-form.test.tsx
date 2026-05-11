// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/preact";
import type { AssetRefLike, ImageGalleryData, ValueListData } from "@sosb/schema";
import { ImageGalleryDataSchema, ValueListDataSchema } from "@sosb/schema";

import { BlockForm } from "../src/block-form.js";

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

describe("BlockForm — valueList items add/remove/reorder", () => {
  afterEach(cleanup);

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
    expect(uploader).toHaveBeenCalledWith(file);
    expect(patches.length).toBe(1);
    expect(patches[0]!.path).toEqual(["images", 1, "asset"]);
    expect(patches[0]!.value).toEqual(uploaded);
  });
});
