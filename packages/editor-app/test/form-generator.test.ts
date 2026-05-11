import { describe, expect, test } from "vitest";
import type { ZodType } from "zod";
import { z } from "zod";
import {
  AssetRefSchema,
  ImageGalleryDataSchema,
  PartnerLogosDataSchema,
  SiteSchema,
} from "@sosb/schema";

import { fieldsFromSchema, type FieldNode } from "../src/form-generator.js";

/**
 * The form generator's job is to introspect a Zod schema and produce a field
 * tree the form renderer walks. The site spine is the v1 production driver,
 * so we test against a few standalone schemas first (focused unit coverage)
 * and then against the real `SiteSchema` (smoke-style integration).
 */

describe("fieldsFromSchema — primitives", () => {
  test("recognises a top-level required string", () => {
    const schema = z.looseObject({ name: z.string().min(1) });
    const fields = fieldsFromSchema(schema);

    const name = byPath(fields, ["name"]);
    expect(name?.kind).toBe("string");
    expect(name?.optional).toBe(false);
  });

  test("recognises a top-level optional string", () => {
    const schema = z.looseObject({ tagline: z.string().optional() });
    const fields = fieldsFromSchema(schema);
    const tagline = byPath(fields, ["tagline"]);
    expect(tagline?.kind).toBe("string");
    expect(tagline?.optional).toBe(true);
  });

  test("recognises a number field", () => {
    const schema = z.looseObject({ foundedYear: z.number().int().optional() });
    const fields = fieldsFromSchema(schema);
    expect(byPath(fields, ["foundedYear"])?.kind).toBe("number");
  });

  test("recognises a boolean field", () => {
    const schema = z.looseObject({ showInNav: z.boolean() });
    const fields = fieldsFromSchema(schema);
    expect(byPath(fields, ["showInNav"])?.kind).toBe("boolean");
  });

  test("recognises an enum field and exposes its options", () => {
    const schema = z.looseObject({ density: z.enum(["compact", "comfortable"]).optional() });
    const fields = fieldsFromSchema(schema);
    const density = byPath(fields, ["density"]);
    expect(density?.kind).toBe("enum");
    if (density?.kind === "enum") {
      expect(density.options).toEqual(["compact", "comfortable"]);
    }
  });
});

describe("fieldsFromSchema — composition", () => {
  test("nested objects produce nested field trees", () => {
    const schema = z.looseObject({
      org: z.looseObject({
        name: z.string().min(1),
        tagline: z.string().optional(),
      }),
    });
    const fields = fieldsFromSchema(schema);
    const org = byPath(fields, ["org"]);
    expect(org?.kind).toBe("object");
    expect(byPath(fields, ["org", "name"])?.kind).toBe("string");
    expect(byPath(fields, ["org", "tagline"])?.kind).toBe("string");
  });

  test("arrays expose element schemas as a child field-tree", () => {
    const schema = z.looseObject({
      languages: z.array(z.string().min(1)),
    });
    const fields = fieldsFromSchema(schema);
    const langs = byPath(fields, ["languages"]);
    expect(langs?.kind).toBe("array");
    if (langs?.kind === "array") {
      expect(langs.element.kind).toBe("string");
    }
  });

  test("SpineForm walk skips the theme sub-tree", () => {
    // Per ADR 0043 and CONTEXT.md's revised Site spine, `theme` is owned by
    // ThemeForm and must not be rendered by the SpineForm walk. Mirrors the
    // existing `blocks` carve-out (which keeps BlockForm authority intact).
    const schema = z.object({
      org: z.object({ name: z.string() }),
      theme: z.object({ id: z.string() }),
    });
    const fields = fieldsFromSchema(schema, {});
    const fieldNames = fields.map((f) => f.name);
    expect(fieldNames).toContain("org");
    expect(fieldNames).not.toContain("theme");
  });

  test("a nested theme key inside an unrelated path is NOT carved out", () => {
    // The carve-out is at the top-level walk only. Block data schemas (or any
    // other nested object) might legitimately have a `theme` field; we must
    // not silently drop it.
    const schema = z.object({
      pages: z.array(
        z.object({
          theme: z.string(),
        }),
      ),
    });
    const fields = fieldsFromSchema(schema, {});
    const pages = fields.find((f) => f.name === "pages");
    expect(pages?.kind).toBe("array");
    if (pages?.kind === "array" && pages.element.kind === "object") {
      const nestedNames = pages.element.fields.map((f) => f.name);
      expect(nestedNames).toContain("theme");
    }
  });
});

describe("form-generator custom dispatch (ADR 0043)", () => {
  test("emits a custom node when a path matches a renderer override", () => {
    const schema = z.object({
      themeId: z.string().min(1),
    });
    const overrides = [{ path: "themeId", renderer: "theme-picker" }];
    const fields = fieldsFromSchema(schema, { overrides });
    const node = fields[0]!;
    expect(node.kind).toBe("custom");
    if (node.kind === "custom") {
      expect(node.renderer).toBe("theme-picker");
    }
  });

  test("emits a custom node when a schema matches the registry", () => {
    const InnerSchema = z.object({ hash: z.string(), mime: z.string() });
    const outer = z.object({ asset: InnerSchema });
    const fields = fieldsFromSchema(outer, {
      schemaRenderers: new Map([[InnerSchema, "asset-picker"]]),
    });
    // The "asset" field should be a custom node, not an object node.
    const node = fields[0]!;
    expect(node.kind).toBe("custom");
    if (node.kind === "custom") {
      expect(node.renderer).toBe("asset-picker");
    }
  });

  test("passes through default rendering when no override applies", () => {
    const schema = z.object({ name: z.string() });
    const fields = fieldsFromSchema(schema, {});
    const node = fields[0]!;
    expect(node.kind).toBe("string");
  });

  test("attaches label override to default nodes", () => {
    const schema = z.object({ slug: z.string() });
    const overrides = [{ path: "slug", label: "Page address" }];
    const fields = fieldsFromSchema(schema, { overrides });
    const node = fields[0]!;
    expect(node.kind).toBe("string");
    expect(node.label).toBe("Page address");
  });

  test("attaches tier override to default nodes", () => {
    const schema = z.object({ slug: z.string() });
    const overrides = [{ path: "slug", tier: "advanced" as const }];
    const fields = fieldsFromSchema(schema, { overrides });
    const node = fields[0]!;
    expect(node.tier).toBe("advanced");
  });
});

describe("form-generator schema-identity dispatch — block data integration", () => {
  // T9 (ADR 0043). The T3 tests above use ad-hoc schemas to prove the
  // `schemaRenderers` map dispatches by reference equality. T9 wires the
  // same mechanism through a REAL block-data schema from `@sosb/schema`
  // and asserts that, when AssetRefSchema is registered to "asset-picker",
  // the nested asset slot becomes a single custom node — the walker does
  // NOT recurse into the AssetRef's hash/path/mime/etc. leaves.
  //
  // The asset slot must short-circuit BEFORE the default object branch
  // would have emitted a fieldset of text inputs (the very UX failure
  // mode ADR 0044 prohibits and the asset picker exists to replace).

  test("PartnerLogosDataSchema: partners[].logo dispatches to asset-picker", () => {
    // Canonical integration: PartnerLogosDataSchema.partners[].logo references
    // the same `AssetRefSchema` object that `@sosb/schema` re-exports, so
    // dispatch is via reference equality on the public symbol.
    const fields = fieldsFromSchema(PartnerLogosDataSchema, {
      schemaRenderers: new Map<ZodType, string>([[AssetRefSchema, "asset-picker"]]),
    });

    const partners = fields.find((f) => f.name === "partners");
    expect(partners?.kind).toBe("array");
    if (partners?.kind !== "array") return;

    const partnerElement = partners.element;
    expect(partnerElement.kind).toBe("object");
    if (partnerElement.kind !== "object") return;

    const logo = partnerElement.fields.find((f) => f.name === "logo");
    expect(logo).toBeDefined();
    expect(logo?.kind).toBe("custom");
    if (logo?.kind !== "custom") return;
    expect(logo.renderer).toBe("asset-picker");
    expect(logo.path).toEqual(["partners", "[]", "logo"]);

    // Critical: the AssetRef's structural leaves must NOT appear anywhere in
    // the produced tree. If they did, the walker would have recursed past
    // the dispatch point and the editor would render the very text-input
    // fieldset the picker is meant to replace.
    const partnerLogosTree: FieldNode = {
      kind: "object",
      name: "<root>",
      path: [],
      optional: false,
      fields,
    };
    for (const leaf of ["hash", "path", "metadataPath", "mime", "width", "height"] as const) {
      expect(findAllByName(partnerLogosTree, leaf)).toEqual([]);
    }
  });

  test("ImageGalleryDataSchema: images[].asset dispatches to asset-picker", () => {
    // Canonical T9 case from the plan. After the AssetRef consolidation
    // refactor (`packages/schema/src/blocks/asset-ref.ts`), every
    // image-bearing block schema embeds the SAME `AssetRefSchema` Zod
    // object, so dispatch via reference equality on the public symbol
    // works identically for image-gallery and partner-logos.
    const fields = fieldsFromSchema(ImageGalleryDataSchema, {
      schemaRenderers: new Map<ZodType, string>([[AssetRefSchema, "asset-picker"]]),
    });

    const images = fields.find((f) => f.name === "images");
    expect(images?.kind).toBe("array");
    if (images?.kind !== "array") return;

    const imageElement = images.element;
    expect(imageElement.kind).toBe("object");
    if (imageElement.kind !== "object") return;

    const asset = imageElement.fields.find((f) => f.name === "asset");
    expect(asset).toBeDefined();
    expect(asset?.kind).toBe("custom");
    if (asset?.kind !== "custom") return;
    expect(asset.renderer).toBe("asset-picker");
    expect(asset.path).toEqual(["images", "[]", "asset"]);

    // The other GalleryImage fields (alt, caption) must still walk normally
    // — the short-circuit applies to `asset` only, not the whole element.
    const alt = imageElement.fields.find((f) => f.name === "alt");
    expect(alt?.kind).toBe("string");

    // AssetRef leaves (hash/path/metadataPath/mime/width/height) must be
    // absent from the output: the walker is supposed to short-circuit on
    // the AssetRef identity BEFORE recursing into its fields.
    const imageGalleryTree: FieldNode = {
      kind: "object",
      name: "<root>",
      path: [],
      optional: false,
      fields,
    };
    for (const leaf of ["hash", "metadataPath", "mime", "width", "height"] as const) {
      expect(findAllByName(imageGalleryTree, leaf)).toEqual([]);
    }
    // `path` is a leaf inside AssetRef AND nowhere else in this schema, so
    // its absence is a direct proof the asset short-circuited.
    expect(findAllByName(imageGalleryTree, "path")).toEqual([]);
  });
});

describe("fieldsFromSchema — site spine integration", () => {
  test("picks up org.name as a required string", () => {
    const fields = fieldsFromSchema(SiteSchema);
    const orgName = byPath(fields, ["org", "name"]);
    expect(orgName?.kind).toBe("string");
    expect(orgName?.optional).toBe(false);
  });

  test("picks up org.email as an optional string", () => {
    const fields = fieldsFromSchema(SiteSchema);
    const email = byPath(fields, ["org", "email"]);
    expect(email?.kind).toBe("string");
    expect(email?.optional).toBe(true);
  });

  test("picks up defaultLanguage and languages array, and carves theme out", () => {
    // Per ADR 0043 and CONTEXT.md, the SpineForm walk excludes the `theme`
    // sub-tree — it's owned by ThemeForm. `defaultLanguage` and `languages`
    // remain in the spine. (Previously this test asserted theme.id was a
    // string; updated to reflect the carve-out contract.)
    const fields = fieldsFromSchema(SiteSchema);
    expect(byPath(fields, ["theme"])).toBeUndefined();
    expect(byPath(fields, ["defaultLanguage"])?.kind).toBe("string");
    const langs = byPath(fields, ["languages"]);
    expect(langs?.kind).toBe("array");
  });

  test("does NOT walk into pages[].blocks (block forms are out of scope per #9-#22)", () => {
    const fields = fieldsFromSchema(SiteSchema);
    const pages = byPath(fields, ["pages"]);
    expect(pages?.kind).toBe("array");
    if (pages?.kind === "array") {
      // Blocks live behind pages[] and are owned by future block-form issues.
      // The site-spine generator may still surface page metadata (slug,
      // navLabel), but block forms must not appear.
      const allBlockNodes = collectKinds(pages.element, "blocks");
      expect(allBlockNodes).toHaveLength(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Helpers — pure walkers over the produced field tree.
// ---------------------------------------------------------------------------

function byPath(fields: FieldNode[], path: (string | number)[]): FieldNode | undefined {
  let current: FieldNode | undefined;
  let cursor: FieldNode[] = fields;
  for (const seg of path) {
    current = cursor.find((f) => f.name === String(seg));
    if (!current) return undefined;
    if (current.kind === "object") {
      cursor = current.fields;
    } else if (current.kind === "array") {
      // Array elements are reached via a synthetic '[]' child if the consumer
      // wants to descend into them; for path lookups stop at the array node.
      cursor = [];
    } else {
      cursor = [];
    }
  }
  return current;
}

function collectKinds(node: FieldNode, name: string): FieldNode[] {
  const matches: FieldNode[] = [];
  function walk(n: FieldNode): void {
    if (n.name === name) matches.push(n);
    if (n.kind === "object") n.fields.forEach(walk);
    if (n.kind === "array") walk(n.element);
  }
  walk(node);
  return matches;
}

/**
 * Collect every node anywhere in the tree whose `name` matches. Used by the
 * T9 integration tests to assert that AssetRef leaves (hash/mime/path/...)
 * never appear after a schema-identity short-circuit.
 */
function findAllByName(root: FieldNode, name: string): FieldNode[] {
  const matches: FieldNode[] = [];
  function walk(n: FieldNode): void {
    if (n.name === name) matches.push(n);
    if (n.kind === "object") n.fields.forEach(walk);
    if (n.kind === "array") walk(n.element);
  }
  walk(root);
  return matches;
}

