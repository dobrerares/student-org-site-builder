/**
 * Schema-introspection form generator.
 *
 * Walks a Zod 4 schema (the site-spine `SiteSchema`, in production) and
 * returns a tree of `FieldNode`s the form renderer iterates over to emit
 * `<input>` / `<select>` / nested-fieldset markup. Adding a new spine field
 * is purely a schema change — no editor code change.
 *
 * Scope (per #7): primitives `string`, `number`, `boolean`, `enum`, plus
 * `optional` and nested `object` and `array`. Block forms are out of scope
 * (they live in #9-#22), so the walk SKIPS the `pages[].blocks` array's
 * element schema and surfaces just the path to it. The renderer can show a
 * "blocks editor lives here in a future issue" placeholder.
 *
 * The implementation deliberately reads `def.type` strings instead of
 * relying on `instanceof` checks against Zod's internal classes, because
 * the latter break across Zod minor versions. `def.type` is part of Zod 4's
 * documented schema-meta surface.
 */

import type { ZodType } from "zod";

export type FieldNode =
  | { kind: "string"; name: string; path: (string | number)[]; optional: boolean }
  | { kind: "number"; name: string; path: (string | number)[]; optional: boolean }
  | { kind: "boolean"; name: string; path: (string | number)[]; optional: boolean }
  | {
      kind: "enum";
      name: string;
      path: (string | number)[];
      optional: boolean;
      options: readonly string[];
    }
  | {
      kind: "object";
      name: string;
      path: (string | number)[];
      optional: boolean;
      fields: FieldNode[];
    }
  | {
      kind: "array";
      name: string;
      path: (string | number)[];
      optional: boolean;
      element: FieldNode;
    };

interface ZodInternalDef {
  readonly type: string;
  readonly innerType?: ZodType;
  readonly element?: ZodType;
  readonly entries?: Record<string, string>;
}

/**
 * Loose introspection view over Zod 4's internal `.def` and `.shape`
 * accessors. We deliberately read these via a structural alias rather than
 * `instanceof` checks against Zod's classes, because the class hierarchy
 * shifts across Zod minor versions but the `def.type` strings are part of
 * the documented metadata surface.
 */
type ZodIntrospect = {
  readonly def: ZodInternalDef;
  readonly shape?: Record<string, ZodType>;
};

/**
 * Walk the top-level fields of an object schema. Returns a flat list of
 * direct child fields (each with their own descendants nested in `fields`
 * or `element`).
 */
export function fieldsFromSchema(schema: ZodType): FieldNode[] {
  const introspect = schema as ZodIntrospect;
  if (introspect.def.type !== "object" || introspect.shape === undefined) {
    throw new Error(
      `fieldsFromSchema: expected an object schema at the top level, got ${introspect.def.type}`,
    );
  }
  return Object.entries(introspect.shape).map(([name, child]) => nodeFor(name, child, [name]));
}

function nodeFor(name: string, schema: ZodType, path: string[]): FieldNode {
  let current = schema as ZodIntrospect;
  let optional = false;
  // Strip optional/nullable/default wrappers and track the optional flag.
  // - `optional` and `nullable` mark the field as user-skippable.
  // - `default(...)` is treated as effectively-optional (the user can leave
  //   the input blank and the schema will fall back to the default at parse).
  while (
    current.def.type === "optional" ||
    current.def.type === "nullable" ||
    current.def.type === "default"
  ) {
    optional = true;
    if (current.def.innerType === undefined) break;
    current = current.def.innerType as ZodIntrospect;
  }

  switch (current.def.type) {
    case "string":
      return { kind: "string", name, path, optional };
    case "number":
      return { kind: "number", name, path, optional };
    case "boolean":
      return { kind: "boolean", name, path, optional };
    case "enum": {
      const entries = current.def.entries ?? {};
      const options = Object.values(entries);
      return { kind: "enum", name, path, optional, options };
    }
    case "object": {
      // Object fields. Carve-out: skip the `blocks` array entirely — block
      // forms are owned by #9-#22, not by this issue. The path is still
      // navigable through `pages[]`; the `blocks` key is omitted so a
      // schema-walking consumer (or the form renderer) doesn't try to emit
      // controls for the block sub-tree.
      const shape = (current as ZodIntrospect).shape ?? {};
      const fields = Object.entries(shape)
        .filter(([childName]) => childName !== "blocks")
        .map(([childName, childSchema]) => nodeFor(childName, childSchema, [...path, childName]));
      return { kind: "object", name, path, optional, fields };
    }
    case "array": {
      const elementSchema = current.def.element;
      if (elementSchema === undefined) {
        throw new Error(`form-generator: array '${name}' has no element schema`);
      }
      const element = nodeFor("[]", elementSchema, [...path, "[]"]);
      return { kind: "array", name, path, optional, element };
    }
    default:
      // Fall back to a string node for anything we don't model yet (record,
      // literal, union, etc.). The site spine doesn't currently use these
      // at the leaves we render today; later issues can extend this switch.
      return { kind: "string", name, path, optional };
  }
}
