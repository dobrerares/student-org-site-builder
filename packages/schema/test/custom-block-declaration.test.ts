/**
 * Custom Block declarations (ADR 0055): what a `block.json` may say, and
 * exactly how it is refused when it says something else. The messages are
 * part of the contract — the issue-106 plan requires that an unsupported
 * field is explained to the developer, not shown to an author as a broken
 * form.
 */
import { describe, expect, test } from "vitest";
import {
  CUSTOM_BLOCK_FIELD_KINDS,
  isCustomBlockType,
  localizedText,
  parseCustomBlockDeclaration,
  walkCustomBlockFields,
} from "../src/index.js";
import { PARTNERS_DECLARATION } from "./fixtures/partners-declaration.js";

function expectRejection(raw: unknown, code: string, pattern: RegExp): void {
  const result = parseCustomBlockDeclaration(raw);
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.code).toBe(code);
  expect(result.message).toMatch(pattern);
}

describe("parseCustomBlockDeclaration — accepted", () => {
  test("the Partners example parses with every field kind in the vocabulary", () => {
    const result = parseCustomBlockDeclaration(PARTNERS_DECLARATION);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.declaration.type).toBe("org.example/partners");
    const kinds = new Set<string>();
    walkCustomBlockFields(result.declaration.fields, (field) => kinds.add(field.kind));
    expect([...kinds].sort()).toEqual([...CUSTOM_BLOCK_FIELD_KINDS].sort());
  });

  test("labels translate with fallback to the default", () => {
    const result = parseCustomBlockDeclaration(PARTNERS_DECLARATION);
    if (!result.ok) throw new Error(result.message);
    expect(localizedText(result.declaration.label, "ro")).toBe("Parteneri");
    expect(localizedText(result.declaration.label, "en")).toBe("Partners");
    expect(localizedText(result.declaration.label, "de")).toBe("Partners");
    expect(localizedText("Plain", "ro")).toBe("Plain");
    expect(localizedText(undefined, "ro")).toBe("");
  });

  test("unknown keys are preserved (ADR 0002)", () => {
    const result = parseCustomBlockDeclaration({
      ...PARTNERS_DECLARATION,
      icon: "handshake",
      fields: [{ name: "a", kind: "text", label: "A", placeholder: "later" }],
    });
    if (!result.ok) throw new Error(result.message);
    expect((result.declaration as { icon?: unknown }).icon).toBe("handshake");
    expect((result.declaration.fields[0] as { placeholder?: unknown }).placeholder).toBe("later");
  });

  test("walkCustomBlockFields reports data paths with [] for list entries", () => {
    const result = parseCustomBlockDeclaration(PARTNERS_DECLARATION);
    if (!result.ok) throw new Error(result.message);
    const paths: string[] = [];
    walkCustomBlockFields(result.declaration.fields, (_field, path) => paths.push(path.join(".")));
    expect(paths).toContain("groups.[].partners.[].image");
    expect(paths).toContain("groups.[].heading");
  });
});

describe("parseCustomBlockDeclaration — rejected", () => {
  test("an unsupported field kind names the field and lists what is supported", () => {
    expectRejection(
      {
        ...PARTNERS_DECLARATION,
        fields: [{ name: "tint", kind: "color", label: "Tint" }],
      },
      "unsupported-field-kind",
      /Field "fields\.tint" declares kind "color".*Supported kinds: text, richText/,
    );
  });

  test("an unsupported kind nested inside a list entry is found too", () => {
    expectRejection(
      {
        ...PARTNERS_DECLARATION,
        fields: [
          {
            name: "items",
            kind: "list",
            label: "Items",
            item: { kind: "group", fields: [{ name: "when", kind: "date", label: "When" }] },
          },
        ],
      },
      "unsupported-field-kind",
      /"fields\.items\.when" declares kind "date"/,
    );
  });

  test("a newer declaration format asks for a newer builder before anything else", () => {
    expectRejection(
      { ...PARTNERS_DECLARATION, formatVersion: 2, fields: [{ kind: "color" }] },
      "format-version-unsupported",
      /format version 2.*Update the builder/,
    );
    expectRejection(
      { ...PARTNERS_DECLARATION, builder: { formatVersion: 3 } },
      "format-version-unsupported",
      /format version 3/,
    );
  });

  test("a type id without a namespace slash", () => {
    expectRejection(
      { ...PARTNERS_DECLARATION, type: "partners" },
      "invalid",
      /type: must be a namespaced type id/,
    );
    expectRejection({ ...PARTNERS_DECLARATION, type: "Org/Partners" }, "invalid", /type:/);
  });

  test("a list whose entries are not groups", () => {
    expectRejection(
      {
        ...PARTNERS_DECLARATION,
        fields: [{ name: "names", kind: "list", label: "Names", item: { kind: "text" } }],
      },
      "invalid",
      /fields\.0\.item/,
    );
  });

  test("a choice default that is not one of the options", () => {
    expectRejection(
      {
        ...PARTNERS_DECLARATION,
        fields: [
          {
            name: "size",
            kind: "choice",
            label: "Size",
            options: [{ value: "s", label: "Small" }],
            default: "xl",
          },
        ],
      },
      "invalid",
      /default must be one of the declared option values/,
    );
  });

  test("a default on a text field is not part of the contract", () => {
    // Text, images and lists start empty (issue-106 plan). A `default` on a
    // text field is an unknown key — preserved, not honoured — so the loader
    // accepts it and the defaults module ignores it. Documented behaviour.
    const result = parseCustomBlockDeclaration({
      ...PARTNERS_DECLARATION,
      fields: [{ name: "a", kind: "text", label: "A", default: "hello" }],
    });
    expect(result.ok).toBe(true);
  });

  test("duplicate field names in one group", () => {
    expectRejection(
      {
        ...PARTNERS_DECLARATION,
        fields: [
          { name: "a", kind: "text", label: "A" },
          { name: "a", kind: "number", label: "A again" },
        ],
      },
      "invalid",
      /field name "a" is declared twice/,
    );
  });

  test("a bad field name, a missing label, an empty fields list", () => {
    expectRejection(
      { ...PARTNERS_DECLARATION, fields: [{ name: "Bad-Name", kind: "text", label: "x" }] },
      "invalid",
      /must be an identifier/,
    );
    expectRejection(
      { ...PARTNERS_DECLARATION, fields: [{ name: "a", kind: "text" }] },
      "invalid",
      /label/,
    );
    expectRejection({ ...PARTNERS_DECLARATION, fields: [] }, "invalid", /fields/);
  });

  test("min greater than max, minItems greater than maxItems", () => {
    expectRejection(
      {
        ...PARTNERS_DECLARATION,
        fields: [{ name: "n", kind: "number", label: "N", min: 5, max: 1 }],
      },
      "invalid",
      /min must not be greater than max/,
    );
    expectRejection(
      {
        ...PARTNERS_DECLARATION,
        fields: [
          {
            name: "l",
            kind: "list",
            label: "L",
            minItems: 3,
            maxItems: 1,
            item: { kind: "group", fields: [{ name: "a", kind: "text", label: "A" }] },
          },
        ],
      },
      "invalid",
      /minItems must not be greater than maxItems/,
    );
  });

  test("nesting past the depth limit", () => {
    let field: unknown = { name: "leaf", kind: "text", label: "Leaf" };
    for (let depth = 0; depth < 6; depth += 1) {
      field = { name: `g${depth}`, kind: "group", label: "G", fields: [field] };
    }
    expectRejection({ ...PARTNERS_DECLARATION, fields: [field] }, "invalid", /nest deeper than 5/);
  });
});

describe("isCustomBlockType", () => {
  test("namespaced ids with a slash are Custom Block types; built-ins and Theme ids are not", () => {
    expect(isCustomBlockType("org.example/partners")).toBe(true);
    expect(isCustomBlockType("campus-tools/partners")).toBe(true);
    expect(isCustomBlockType("partnerLogos")).toBe(false);
    expect(isCustomBlockType("org.example.practice")).toBe(false);
    expect(isCustomBlockType("futureBlock")).toBe(false);
  });
});
