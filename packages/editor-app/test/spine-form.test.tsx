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
 * SpineForm + "Show advanced" toggle (ADR 0043, T16).
 *
 * The SpineForm holds a per-instance `showAdvanced` flag. It reads the
 * pre-walked `FieldNode[]` (the editor-app composes them via
 * `fieldsFromSchema(SiteSchema, { overrides: SPINE_FIELD_METADATA })`)
 * and respects each node's `tier`:
 *   - default → always rendered
 *   - advanced → rendered only when the toggle is on
 *   - hidden  → never rendered
 *
 * Production-wired SPINE_FIELD_METADATA today only marks fields under
 * `pages.[].*` as advanced/hidden, and SpineForm renders array shapes as
 * a read-only summary count (no per-item inputs). To exercise the
 * renderer's tier gate at the leaf level we construct ad-hoc field
 * trees with explicit `tier` markers — the editor's array-summary
 * rendering is intentionally out of scope for tier coverage.
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

describe("SpineForm — Show advanced toggle (ADR 0043, T16)", () => {
  afterEach(cleanup);

  test("renders the AdvancedToggle control", () => {
    const fields = fieldsFromSchema(SiteSchema, { overrides: SPINE_FIELD_METADATA });
    const { container } = render(
      <SpineForm {...spineProps(fields)} />,
    );
    expect(container.querySelector('[data-testid="advanced-toggle"]')).not.toBeNull();
  });

  test("hides tier=advanced fields by default (toggle off)", () => {
    const fields: FieldNode[] = [
      stringNode(["org", "name"]),
      stringNode(["org", "legalName"], "advanced"),
    ];
    const { container } = render(
      <SpineForm {...spineProps(fields)} />,
    );
    expect(container.querySelector('[data-field="org.name"]')).not.toBeNull();
    expect(container.querySelector('[data-field="org.legalName"]')).toBeNull();
  });

  test("reveals tier=advanced fields when the toggle is on", () => {
    const fields: FieldNode[] = [
      stringNode(["org", "name"]),
      stringNode(["org", "legalName"], "advanced"),
    ];
    const { container } = render(
      <SpineForm {...spineProps(fields)} />,
    );
    const checkbox = container.querySelector<HTMLInputElement>(
      '[data-testid="advanced-toggle"] input[type="checkbox"]',
    );
    expect(checkbox).not.toBeNull();
    expect(container.querySelector('[data-field="org.legalName"]')).toBeNull();

    fireEvent.click(checkbox!);
    expect(container.querySelector('[data-field="org.legalName"]')).not.toBeNull();
  });

  test("never renders tier=hidden fields regardless of toggle state", () => {
    const fields: FieldNode[] = [
      stringNode(["org", "name"]),
      stringNode(["org", "internalNote"], "hidden"),
    ];
    const { container } = render(
      <SpineForm {...spineProps(fields)} />,
    );
    expect(container.querySelector('[data-field="org.internalNote"]')).toBeNull();

    const checkbox = container.querySelector<HTMLInputElement>(
      '[data-testid="advanced-toggle"] input[type="checkbox"]',
    );
    fireEvent.click(checkbox!);
    expect(container.querySelector('[data-field="org.internalNote"]')).toBeNull();
  });

  test("toggle state is per-instance (separate mounts have independent state)", () => {
    const fields: FieldNode[] = [
      stringNode(["org", "name"]),
      stringNode(["org", "legalName"], "advanced"),
    ];

    const first = render(
      <SpineForm {...spineProps(fields)} />,
    );
    const second = render(
      <SpineForm {...spineProps(fields)} />,
    );

    // Both start with the advanced field hidden.
    expect(first.container.querySelector('[data-field="org.legalName"]')).toBeNull();
    expect(second.container.querySelector('[data-field="org.legalName"]')).toBeNull();

    // Toggle the first form on; the second must stay off.
    const firstCheckbox = first.container.querySelector<HTMLInputElement>(
      '[data-testid="advanced-toggle"] input[type="checkbox"]',
    );
    fireEvent.click(firstCheckbox!);
    expect(first.container.querySelector('[data-field="org.legalName"]')).not.toBeNull();
    expect(second.container.querySelector('[data-field="org.legalName"]')).toBeNull();
  });
});
