// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/preact";
import type { ValueListData } from "@sosb/schema";
import { ValueListDataSchema } from "@sosb/schema";

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
