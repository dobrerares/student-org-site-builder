import { describe, expect, test } from "vitest";
import { RichTextDataSchema } from "@sosb/schema";

import { fieldsFromSchema } from "../src/form-generator.js";

/**
 * Auto-generated form for the richText block.
 *
 * Per the issue contract (#9), "Editor form is auto-generated from the
 * schema." The site-spine form generator (#7) introspects Zod schemas via
 * `fieldsFromSchema`. This test demonstrates that the same framework
 * trivially produces a form descriptor for a block's data schema — no
 * special-case code per block. The block-list editor UI (which composes
 * these descriptors into a Preact form) is owned by a follow-up issue;
 * the contract this test pins is "the framework already covers richText".
 */
describe("fieldsFromSchema — richText block data", () => {
  test("produces markdown and alignment controls", () => {
    const fields = fieldsFromSchema(RichTextDataSchema);
    expect(fields.map((field) => field.name)).toEqual(["markdown", "titleAlign", "paragraphAlign"]);

    expect(fields[0]).toMatchObject({ name: "markdown", kind: "string" });
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

  test("the produced field tree is independent of any UI framework", () => {
    // Pure data — no Preact import required to walk it.
    const fields = fieldsFromSchema(RichTextDataSchema);
    const json = JSON.parse(JSON.stringify(fields)) as unknown;
    expect(json).toBeDefined();
  });
});
