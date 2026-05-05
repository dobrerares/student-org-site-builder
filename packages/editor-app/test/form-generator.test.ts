import { describe, expect, test } from "vitest";
import { z } from "zod";
import { SiteSchema } from "@sosb/schema";

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

  test("picks up theme.id, defaultLanguage, and languages array", () => {
    const fields = fieldsFromSchema(SiteSchema);
    expect(byPath(fields, ["theme", "id"])?.kind).toBe("string");
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
