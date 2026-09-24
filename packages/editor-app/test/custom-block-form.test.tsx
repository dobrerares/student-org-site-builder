/** @jsxImportSource react */
// @vitest-environment jsdom
/**
 * The form the builder generates from a Custom Block declaration (ADR 0055).
 *
 * Every control is one the built-in Blocks already use — the declaration
 * only chooses which. This file pins that each field kind lands on the right
 * control, that labels and help follow the editor locale with fallback, that
 * lists add *empty* entries under their declared entry name, and that a
 * validation finding is shown beside the field it names.
 */
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { AssetRefLike, DocumentAssetRef, Site } from "@sosb/schema";
import { parseCustomBlockDeclaration, defaultCustomBlockData } from "@sosb/schema";

import { BlockForm } from "../src/block-form.js";
import {
  customBlockNewItemFor,
  customBlockOverridesFor,
  customBlockSchemaFor,
} from "../src/custom-block-form.js";
import { fieldsFromSchema } from "../src/form-generator.js";
import { SCHEMA_FIELD_RENDERERS } from "../src/media-picker-renderers.js";
import { PARTNERS_DECLARATION } from "./fixtures/partners-package.js";
import minimal from "./fixtures/minimal-site.json" with { type: "json" };

const declaration = (() => {
  const result = parseCustomBlockDeclaration(PARTNERS_DECLARATION);
  if (!result.ok) throw new Error(result.message);
  return result.declaration;
})();

function noopUploader(): Promise<AssetRefLike> {
  return Promise.reject(new Error("no upload in this test"));
}
function noopDocumentUploader(): Promise<DocumentAssetRef> {
  return Promise.reject(new Error("no upload in this test"));
}

interface Harness {
  data: Record<string, unknown>;
  patches: { path: readonly (string | number)[]; value: unknown }[];
  arrayChanges: { path: readonly (string | number)[]; next: unknown[] }[];
}

function mount(
  data: Record<string, unknown>,
  options: {
    locale?: string;
    issues?: {
      severity: "warning" | "error";
      path: (string | number)[];
      code: string;
      message: string;
    }[];
    richText?: boolean;
  } = {},
) {
  const harness: Harness = { data, patches: [], arrayChanges: [] };
  const site = structuredClone(minimal) as unknown as Site;
  const view = render(
    <BlockForm
      schema={customBlockSchemaFor(declaration)}
      data={harness.data}
      onPatch={(path, value) => harness.patches.push({ path, value })}
      onArrayChange={(path, next) => harness.arrayChanges.push({ path, next })}
      newItem={customBlockNewItemFor(declaration)}
      uploader={noopUploader}
      documentUploader={noopDocumentUploader}
      overrides={customBlockOverridesFor(declaration, options.locale ?? "en")}
      issues={options.issues ?? []}
      richText={
        options.richText === true
          ? {
              site,
              lang: "ro",
              onApplySite: () => undefined,
              uploader: noopUploader,
              onCommitVisit: () => undefined,
            }
          : undefined
      }
    />,
  );
  return { ...view, harness };
}

describe("customBlockSchemaFor + fieldsFromSchema", () => {
  test("every declared kind maps to the builder's own control", () => {
    const fields = fieldsFromSchema(customBlockSchemaFor(declaration), {
      schemaRenderers: SCHEMA_FIELD_RENDERERS,
      overrides: customBlockOverridesFor(declaration, "en"),
    });
    const byName = Object.fromEntries(fields.map((f) => [f.name, f]));
    expect(byName["heading"]).toMatchObject({ kind: "string", label: "Heading", optional: true });
    expect(byName["intro"]).toMatchObject({ kind: "custom", renderer: "rich-text" });
    expect(byName["count"]).toMatchObject({ kind: "number" });
    expect(byName["showHeadings"]).toMatchObject({ kind: "boolean" });
    expect(byName["layout"]).toMatchObject({
      kind: "enum",
      options: ["tight", "roomy"],
      optionLabels: { tight: "Tight", roomy: "Roomy" },
    });
    expect(byName["brochure"]).toMatchObject({ kind: "custom", renderer: "document-picker" });
    expect(byName["contact"]).toMatchObject({ kind: "object" });
    expect(byName["groups"]).toMatchObject({ kind: "array", itemLabel: "group" });
    const groups = byName["groups"] as {
      element: { fields: { name: string; renderer?: string; kind: string }[] };
    };
    const partners = groups.element.fields.find((f) => f.name === "partners") as {
      element: { fields: { name: string; renderer?: string }[] };
    };
    expect(partners.element.fields.map((f) => [f.name, f.renderer])).toEqual([
      ["name", undefined],
      ["image", "image-with-description"],
      ["link", "link-target"],
    ]);
  });

  test("labels, help and option labels follow the locale and fall back to the default", () => {
    const ro = customBlockOverridesFor(declaration, "ro");
    expect(ro.find((o) => o.path === "heading")).toMatchObject({
      label: "Titlu",
      hint: "Apare deasupra grupurilor.",
    });
    expect(ro.find((o) => o.path === "layout")?.optionLabels).toEqual({
      tight: "Strâns",
      roomy: "Roomy",
    });
    expect(ro.find((o) => o.path === "groups")?.itemLabel).toBe("grup");
    // No Romanian for "Intro" → the default.
    expect(ro.find((o) => o.path === "intro")?.label).toBe("Intro");
  });
});

describe("BlockForm over a Custom Block declaration", () => {
  afterEach(cleanup);

  test("renders the declared controls with their labels", () => {
    const { container } = mount(defaultCustomBlockData(declaration));
    expect(container.querySelector('input[data-field="heading"]')).not.toBeNull();
    expect(container.querySelector('[data-field-label="heading"] span')?.textContent).toBe(
      "Heading",
    );
    expect(container.querySelector('[data-testid="field-hint"]')?.textContent).toBe(
      "Shown above the groups.",
    );
    expect(container.querySelector('input[type="number"][data-field="count"]')).not.toBeNull();
    const toggle = container.querySelector<HTMLInputElement>(
      'input[type="checkbox"][data-field="showHeadings"]',
    );
    expect(toggle?.checked).toBe(true);
    const select = container.querySelector<HTMLSelectElement>('select[data-field="layout"]');
    expect(select?.value).toBe("tight");
    expect([...select!.options].map((o) => o.textContent)).toEqual(["(unset)", "Tight", "Roomy"]);
    expect(
      container.querySelector('[data-field="brochure"] [data-testid="document-picker-add"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('fieldset[data-field="contact"] input[data-field="contact.email"]'),
    ).not.toBeNull();
    // No raw-data or JSON control anywhere (ADR 0044).
    expect(container.querySelector("textarea[data-field='data']")).toBeNull();
    // Rich text without the shell's plumbing is an inert marker, never a text box.
    expect(container.querySelector('[data-renderer="rich-text"]')).not.toBeNull();
  });

  test("labels follow the editor locale", () => {
    const { container } = mount({}, { locale: "ro" });
    expect(container.querySelector('[data-field-label="heading"] span')?.textContent).toBe("Titlu");
    const select = container.querySelector<HTMLSelectElement>('select[data-field="layout"]');
    expect([...select!.options].map((o) => o.textContent)).toContain("Strâns");
  });

  test("a saved choice the options no longer include is shown, not replaced", () => {
    const { container } = mount({ layout: "gone" });
    const select = container.querySelector<HTMLSelectElement>('select[data-field="layout"]');
    expect(select?.value).toBe("gone");
  });

  test("lists add an empty entry named after the declaration, and nested lists too", () => {
    const { container, harness } = mount({ groups: [] });
    const add = container.querySelector<HTMLButtonElement>(
      'fieldset[data-field="groups"] > button[data-action="add"]',
    );
    expect(add?.textContent).toBe("Add group");
    fireEvent.click(add!);
    expect(harness.arrayChanges).toEqual([{ path: ["groups"], next: [{}] }]);

    cleanup();
    const nested = mount({ groups: [{ heading: "Gold", partners: [] }] });
    const addPartner = nested.container.querySelector<HTMLButtonElement>(
      'fieldset[data-field="groups.0.partners"] > button[data-action="add"]',
    );
    expect(addPartner?.textContent).toBe("Add partner");
    fireEvent.click(addPartner!);
    expect(nested.harness.arrayChanges).toEqual([{ path: ["groups", 0, "partners"], next: [{}] }]);
  });

  test("list entries have remove and reorder controls", () => {
    const { container, harness } = mount({
      groups: [
        { heading: "A", partners: [] },
        { heading: "B", partners: [] },
      ],
    });
    const items = container.querySelectorAll('[data-testid="groups__item"]');
    expect(items).toHaveLength(2);
    fireEvent.click(items[0]!.querySelector('button[data-action="move-down"]')!);
    expect(
      harness.arrayChanges.at(-1)?.next.map((g) => (g as { heading: string }).heading),
    ).toEqual(["B", "A"]);
    fireEvent.click(items[1]!.querySelector('button[data-action="remove"]')!);
    expect(harness.arrayChanges.at(-1)?.next).toEqual([{ heading: "A", partners: [] }]);
  });

  test("an image field is the Asset picker plus a description that writes the alt", () => {
    const image = {
      hash: "h",
      path: "assets/h.png",
      metadataPath: "assets/h.json",
      mime: "image/png",
      width: 1,
      height: 1,
      alt: "",
    };
    const { container, harness } = mount({
      groups: [{ heading: "A", partners: [{ name: "Alpha", image }] }],
    });
    const field = container.querySelector('fieldset[data-field="groups.0.partners.0.image"]');
    expect(field?.querySelector('[data-testid="asset-picker"]')).not.toBeNull();
    const alt = field?.querySelector<HTMLInputElement>(
      'input[data-field="groups.0.partners.0.image.alt"]',
    );
    expect(alt).not.toBeNull();
    fireEvent.input(alt!, { target: { value: "Alpha logo" } });
    expect(harness.patches.at(-1)).toEqual({
      path: ["groups", 0, "partners", 0, "image"],
      value: { ...image, alt: "Alpha logo" },
    });
    // Without an image there is nothing to describe: the picker offers "Add image".
    cleanup();
    const empty = mount({ groups: [{ heading: "A", partners: [{ name: "Alpha" }] }] });
    expect(empty.container.querySelector('[data-testid="asset-picker-add"]')).not.toBeNull();
    expect(
      empty.container.querySelector('input[data-field="groups.0.partners.0.image.alt"]'),
    ).toBeNull();
  });

  test("a link field is the link picker once the shell supplies the Site", () => {
    const { container } = mount(
      { groups: [{ heading: "A", partners: [{ name: "Alpha" }] }] },
      { richText: true },
    );
    const link = container.querySelector('fieldset[data-field="groups.0.partners.0.link"]');
    expect(link?.querySelector('[data-testid="link-target-select"]')).not.toBeNull();
  });

  test("validation findings are shown beside the field they name", () => {
    const { container } = mount(
      { heading: "", groups: [{ heading: "", partners: [{ name: "x" }] }] },
      {
        issues: [
          {
            severity: "warning",
            path: ["heading"],
            code: "block.custom.field.required",
            message: '"Heading" is required but empty.',
          },
          {
            severity: "warning",
            path: ["groups", 0, "heading"],
            code: "block.custom.field.required",
            message: '"Group heading" is required but empty.',
          },
          {
            severity: "warning",
            path: ["groups"],
            code: "block.custom.list.size",
            message: "too many groups",
          },
        ],
      },
    );
    const heading = container.querySelector('[data-field-label="heading"] [data-field-issue]');
    expect(heading?.textContent).toBe('"Heading" is required but empty.');
    expect(heading?.getAttribute("data-code")).toBe("block.custom.field.required");
    const group = container.querySelector(
      '[data-field-label="groups.0.heading"] [data-field-issue]',
    );
    expect(group?.textContent).toBe('"Group heading" is required but empty.');
    const list = container.querySelector('fieldset[data-field="groups"] > [data-field-issue]');
    expect(list?.textContent).toBe("too many groups");
    // A finding is shown once, at its own field only.
    expect(container.querySelectorAll("[data-field-issue]")).toHaveLength(3);
  });
});
