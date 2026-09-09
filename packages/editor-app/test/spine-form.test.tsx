// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/preact";
import type { Site } from "@sosb/schema";
import { SiteSchema } from "@sosb/schema";

import minimal from "./fixtures/minimal-site.json" with { type: "json" };
import { SPINE_FIELD_METADATA } from "../src/field-metadata.js";
import { fieldsFromSchema, type FieldNode } from "../src/form-generator.js";
import type { AssetRefLike, DocumentAssetRef } from "@sosb/schema";
import { SpineForm } from "../src/spine-form.js";

const stubAsset: AssetRefLike = {
  hash: "stub",
  path: "assets/stub.jpg",
  metadataPath: "assets/stub.metadata.json",
  mime: "image/jpeg",
  width: 1,
  height: 1,
  alt: "stub",
};

const stubUploader = async (): Promise<AssetRefLike> => stubAsset;
const stubDocumentUploader = async (): Promise<DocumentAssetRef> => ({
  hash: "doc",
  path: "assets/doc.pdf",
  metadataPath: "assets/doc.metadata.json",
  mime: "application/pdf",
  byteSize: 1,
  label: "doc",
});

function spineProps(fields: FieldNode[], site: Site = baseSite) {
  return {
    fields,
    site,
    onPatch: () => {},
    uploader: stubUploader,
    documentUploader: stubDocumentUploader,
  };
}

/**
 * SpineForm + "More options" section (ADR 0043, T16; progressive
 * disclosure revision).
 *
 * The SpineForm holds a per-instance `showAdvanced` flag. It reads the
 * pre-walked `FieldNode[]` (the editor-app composes them via
 * `fieldsFromSchema(SiteSchema, { overrides: SPINE_FIELD_METADATA })`)
 * and respects each node's `tier`:
 *   - default → always rendered inline
 *   - advanced → rendered only inside the "More options" section, and
 *                only once that section is open
 *   - hidden  → never rendered
 *
 * To exercise the tier gate at the leaf level we construct ad-hoc field
 * trees with explicit `tier` markers.
 */
const baseSite = minimal as unknown as Site;

function stringNode(path: (string | number)[], tier?: "advanced" | "hidden"): FieldNode {
  const node: FieldNode = {
    kind: "string",
    name: path[path.length - 1] as string,
    path,
    optional: false,
  };
  if (tier !== undefined) {
    node.tier = tier;
  }
  return node;
}

describe("SpineForm — More options section (ADR 0043, T16)", () => {
  afterEach(cleanup);

  test("renders the More options control when the site spine has advanced fields", () => {
    const fields = fieldsFromSchema(SiteSchema, { overrides: SPINE_FIELD_METADATA });
    const { container } = render(<SpineForm {...spineProps(fields)} />);
    const toggle = container.querySelector('[data-testid="advanced-toggle"]');
    expect(toggle).not.toBeNull();
    expect(toggle!.getAttribute("aria-expanded")).toBe("false");
    // The collapsed summary tells the author what is inside.
    expect(toggle!.textContent ?? "").toContain("Founded (year)");
  });

  test("renders no More options section when nothing is advanced", () => {
    const fields: FieldNode[] = [stringNode(["org", "name"])];
    const { container } = render(<SpineForm {...spineProps(fields)} />);
    expect(container.querySelector('[data-testid="more-options"]')).toBeNull();
    expect(container.querySelector('[data-testid="advanced-toggle"]')).toBeNull();
  });

  test("advanced fields render inside the panel, after the basic fields", () => {
    const fields: FieldNode[] = [
      stringNode(["org", "legalName"], "advanced"),
      stringNode(["org", "name"]),
    ];
    const { container } = render(<SpineForm {...spineProps(fields)} />);
    fireEvent.click(container.querySelector('[data-testid="advanced-toggle"]')!);
    const panel = container.querySelector('[data-testid="more-options-panel"]');
    expect(panel).not.toBeNull();
    expect(panel!.querySelector('[data-field="org.legalName"]')).not.toBeNull();
    expect(panel!.querySelector('[data-field="org.name"]')).toBeNull();
    // Schema order put the advanced field first; the form moves it last.
    const all = Array.from(container.querySelectorAll("[data-field]")).map((el) =>
      el.getAttribute("data-field"),
    );
    expect(all.indexOf("org.name")).toBeLessThan(all.indexOf("org.legalName"));
  });

  test("an object whose children are all advanced leaves no empty card behind", () => {
    const seo: FieldNode = {
      kind: "object",
      name: "seo",
      path: ["pages", 0, "seo"],
      optional: true,
      label: "Search engines",
      fields: [
        stringNode(["pages", 0, "seo", "title"], "advanced"),
        stringNode(["pages", 0, "seo", "description"], "advanced"),
      ],
    };
    const fields: FieldNode[] = [stringNode(["pages", 0, "navLabel"]), seo];
    const { container } = render(<SpineForm {...spineProps(fields)} />);
    // Collapsed: the "Search engines" fieldset must not render at all.
    expect(container.querySelector('[data-field="pages.0.seo"]')).toBeNull();
    expect(container.querySelector('[data-testid="advanced-toggle"]')!.textContent).toContain(
      "Search engines",
    );
    fireEvent.click(container.querySelector('[data-testid="advanced-toggle"]')!);
    const panel = container.querySelector('[data-testid="more-options-panel"]');
    expect(panel!.querySelector('[data-field="pages.0.seo"]')).not.toBeNull();
    expect(panel!.querySelector('[data-field="pages.0.seo.title"]')).not.toBeNull();
  });

  test("renders friendly labels from field metadata instead of raw field names", () => {
    const fields: FieldNode[] = [
      { ...stringNode(["org", "legalName"]), label: "Official organization name" },
    ];
    const { container } = render(<SpineForm {...spineProps(fields)} />);
    expect(container.textContent ?? "").toContain("Official organization name");
    expect(container.textContent ?? "").not.toContain("legalName");
  });

  test("hides tier=advanced fields by default (toggle off)", () => {
    const fields: FieldNode[] = [
      stringNode(["org", "name"]),
      stringNode(["org", "legalName"], "advanced"),
    ];
    const { container } = render(<SpineForm {...spineProps(fields)} />);
    expect(container.querySelector('[data-field="org.name"]')).not.toBeNull();
    expect(container.querySelector('[data-field="org.legalName"]')).toBeNull();
  });

  test("reveals tier=advanced fields when the toggle is on", () => {
    const fields: FieldNode[] = [
      stringNode(["org", "name"]),
      stringNode(["org", "legalName"], "advanced"),
    ];
    const { container } = render(<SpineForm {...spineProps(fields)} />);
    const checkbox = container.querySelector<HTMLButtonElement>('[data-testid="advanced-toggle"]');
    expect(checkbox).not.toBeNull();
    expect(container.querySelector('[data-field="org.legalName"]')).toBeNull();

    fireEvent.click(checkbox!);
    expect(container.querySelector('[data-field="org.legalName"]')).not.toBeNull();
  });

  test("never renders tier=hidden fields regardless of toggle state", () => {
    const fields: FieldNode[] = [
      stringNode(["org", "name"]),
      stringNode(["org", "legalName"], "advanced"),
      stringNode(["org", "internalNote"], "hidden"),
    ];
    const { container } = render(<SpineForm {...spineProps(fields)} />);
    expect(container.querySelector('[data-field="org.internalNote"]')).toBeNull();

    const checkbox = container.querySelector<HTMLButtonElement>('[data-testid="advanced-toggle"]');
    fireEvent.click(checkbox!);
    expect(container.querySelector('[data-field="org.internalNote"]')).toBeNull();
  });

  test("toggle state is per-instance (separate mounts have independent state)", () => {
    const fields: FieldNode[] = [
      stringNode(["org", "name"]),
      stringNode(["org", "legalName"], "advanced"),
    ];

    const first = render(<SpineForm {...spineProps(fields)} />);
    const second = render(<SpineForm {...spineProps(fields)} />);

    // Both start with the advanced field hidden.
    expect(first.container.querySelector('[data-field="org.legalName"]')).toBeNull();
    expect(second.container.querySelector('[data-field="org.legalName"]')).toBeNull();

    // Toggle the first form on; the second must stay off.
    const firstCheckbox = first.container.querySelector<HTMLButtonElement>(
      '[data-testid="advanced-toggle"]',
    );
    fireEvent.click(firstCheckbox!);
    expect(first.container.querySelector('[data-field="org.legalName"]')).not.toBeNull();
    expect(second.container.querySelector('[data-field="org.legalName"]')).toBeNull();
  });
});
