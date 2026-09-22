import { describe, expect, test } from "vitest";
import { RichTextDataSchema, RichTextDocumentSchema } from "@sosb/schema";

import { fieldsFromSchema } from "../src/form-generator.js";
import { SCHEMA_FIELD_RENDERERS } from "../src/media-picker-renderers.js";

/**
 * The richText Block's generated form.
 *
 * Two of its three fields are still ordinary generated controls. The third —
 * the document — is dispatched to an editor-owned override by *schema
 * identity* (ADR 0043), the same mechanism the asset pickers use. That is
 * the contract this file pins: the walker does not special-case the Block,
 * and the override is not wired by path.
 */
describe("fieldsFromSchema — richText block data", () => {
  test("produces a custom document control plus the alignment controls", () => {
    const fields = fieldsFromSchema(RichTextDataSchema, {
      schemaRenderers: SCHEMA_FIELD_RENDERERS,
    });
    expect(fields.map((field) => field.name)).toEqual(["doc", "titleAlign", "paragraphAlign"]);

    expect(fields[0]).toMatchObject({ name: "doc", kind: "custom", renderer: "rich-text" });
    expect(fields[1]).toMatchObject({
      name: "titleAlign",
      kind: "enum",
      options: ["left", "center", "right", "justify"],
      optional: true,
    });
    expect(fields[2]).toMatchObject({
      name: "paragraphAlign",
      kind: "enum",
      options: ["left", "center", "right", "justify"],
      optional: true,
    });
  });

  test("the document override is keyed on schema identity, not field name", () => {
    // Reference equality, not shape: a structurally identical copy of the
    // document schema must NOT pick up the override, because that is what
    // guarantees the dispatch cannot be triggered by accident elsewhere.
    expect(SCHEMA_FIELD_RENDERERS.get(RichTextDocumentSchema)).toBe("rich-text");
  });

  test("without the renderer map the document degrades to a generated object", () => {
    // Not a supported configuration — the assertion documents that the
    // override is the only thing standing between the author and a form
    // full of `version` and `content` fields.
    const fields = fieldsFromSchema(RichTextDataSchema);
    expect(fields[0]).toMatchObject({ name: "doc" });
    expect(fields[0]!.kind).not.toBe("custom");
  });

  test("the produced field tree is independent of any UI framework", () => {
    // Pure data — no React import required to walk it.
    const fields = fieldsFromSchema(RichTextDataSchema, {
      schemaRenderers: SCHEMA_FIELD_RENDERERS,
    });
    const json = JSON.parse(JSON.stringify(fields)) as unknown;
    expect(json).toBeDefined();
  });
});
