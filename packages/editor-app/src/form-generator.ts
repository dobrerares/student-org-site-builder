/**
 * Schema-introspection form generator.
 *
 * Walks a Zod 4 schema (the site-spine `SiteSchema`, in production) and
 * returns a tree of `FieldNode`s the form renderer iterates over to emit
 * `<input>` / `<select>` / nested-fieldset markup. Adding a new spine field
 * is purely a schema change — no editor code change.
 *
 * Scope (per #7): primitives `string`, `number`, `boolean`, `enum`, plus
 * `optional` and nested `object` and `array`. Page blocks are edited through
 * `BlockListEditor` / `BlockForm`, so the site-spine walk skips the
 * `pages[].blocks` array's element schema and surfaces just the path to it.
 *
 * Per ADR 0043, two override mechanisms layer on top of the default
 * introspection walk:
 *   1. Schema-identity dispatch (most specific): callers may pass a
 *      `schemaRenderers` Map keyed by ZodType reference. After stripping
 *      wrappers, the walker checks the resulting schema against the map
 *      — a hit yields a `"custom"` node carrying the renderer name. This
 *      is the canonical mechanism for shapes like `AssetRefSchema` where
 *      the structural identity is what dispatch should key on.
 *   2. Path-keyed metadata (less specific): callers may pass an
 *      `overrides` list of `FieldOverride` entries. Each entry can supply
 *      `label`, `tier`, and/or `renderer`. Schema-identity wins over
 *      path-keyed dispatch; if both miss, the default kind switch runs
 *      and any `label`/`tier` from the path-keyed override is attached
 *      to the returned node.
 *
 * The implementation deliberately reads `def.type` strings instead of
 * relying on `instanceof` checks against Zod's internal classes, because
 * the latter break across Zod minor versions. `def.type` is part of Zod 4's
 * documented schema-meta surface.
 */

import type { ZodType } from "zod";

import type { FieldOverride, FieldTier } from "./field-metadata.js";
import { lookupFieldOverride } from "./field-metadata.js";

export type FieldNode =
  | {
      kind: "string";
      name: string;
      path: (string | number)[];
      optional: boolean;
      label?: string;
      tier?: FieldTier;
      hint?: string;
    }
  | {
      kind: "number";
      name: string;
      path: (string | number)[];
      optional: boolean;
      label?: string;
      tier?: FieldTier;
      hint?: string;
    }
  | {
      kind: "boolean";
      name: string;
      path: (string | number)[];
      optional: boolean;
      label?: string;
      tier?: FieldTier;
      hint?: string;
    }
  | {
      kind: "enum";
      name: string;
      path: (string | number)[];
      optional: boolean;
      options: readonly string[];
      label?: string;
      tier?: FieldTier;
      hint?: string;
    }
  | {
      kind: "object";
      name: string;
      path: (string | number)[];
      optional: boolean;
      fields: FieldNode[];
      label?: string;
      tier?: FieldTier;
      hint?: string;
    }
  | {
      kind: "array";
      name: string;
      path: (string | number)[];
      optional: boolean;
      element: FieldNode;
      label?: string;
      tier?: FieldTier;
      hint?: string;
    }
  | {
      kind: "custom";
      name: string;
      path: (string | number)[];
      optional: boolean;
      renderer: string;
      label?: string;
      tier?: FieldTier;
      hint?: string;
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

export interface FieldsFromSchemaOptions {
  /**
   * Path-keyed override list. Each entry can rewrite a leaf's label,
   * mark it as advanced/hidden via `tier`, and/or dispatch it to a
   * named custom renderer.
   */
  readonly overrides?: readonly FieldOverride[];
  /**
   * Schema-identity registry. Keyed by `ZodType` reference (i.e., the
   * same object the caller embedded in the larger schema). Mapped value
   * is the renderer name. When the walker (after stripping wrappers)
   * arrives at a schema present in this map, it short-circuits to a
   * `"custom"` node instead of recursing into the schema's structure.
   */
  readonly schemaRenderers?: ReadonlyMap<ZodType, string>;
}

/**
 * Walk the top-level fields of an object schema. Returns a flat list of
 * direct child fields (each with their own descendants nested in `fields`
 * or `element`).
 */
export function fieldsFromSchema(
  schema: ZodType,
  options: FieldsFromSchemaOptions = {},
): FieldNode[] {
  const introspect = schema as ZodIntrospect;
  if (introspect.def.type !== "object" || introspect.shape === undefined) {
    throw new Error(
      `fieldsFromSchema: expected an object schema at the top level, got ${introspect.def.type}`,
    );
  }
  // Closure: capture options once so the recursion doesn't have to thread them
  // through every signature. Cleaner than parameter explosion as more knobs
  // accrete (ADR 0043 anticipates further renderer registrations).
  const overrides = options.overrides ?? [];
  const schemaRenderers = options.schemaRenderers;

  function nodeFor(name: string, child: ZodType, path: (string | number)[]): FieldNode {
    let current = child as ZodIntrospect;
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

    // Path-keyed override lookup is shared by both the schema-identity short
    // circuit (where label/tier still apply on the custom node) and the
    // default kind switch (where label/tier annotate the default node and
    // `renderer` short-circuits to a custom node).
    const override = lookupFieldOverride(overrides, path);

    // Step 1 — schema-identity dispatch. Reference-equality check against the
    // post-strip schema. Wins over path-keyed dispatch because the schema
    // shape is intrinsic; the path is just where it happens to appear.
    if (schemaRenderers !== undefined) {
      const renderer = schemaRenderers.get(current as unknown as ZodType);
      if (renderer !== undefined) {
        return makeCustomNode(name, path, optional, renderer, override);
      }
    }

    // Step 2 — path-keyed renderer dispatch. Label/tier from the same entry
    // still attach to the resulting custom node.
    if (override?.renderer !== undefined) {
      return makeCustomNode(name, path, optional, override.renderer, override);
    }

    // Step 3 — default kind switch. Any label/tier from the path-keyed
    // override is attached to the returned node.
    switch (current.def.type) {
      case "string":
        return withMeta({ kind: "string", name, path, optional }, override);
      case "number":
        return withMeta({ kind: "number", name, path, optional }, override);
      case "boolean":
        return withMeta({ kind: "boolean", name, path, optional }, override);
      case "enum": {
        const entries = current.def.entries ?? {};
        const options = Object.values(entries);
        return withMeta({ kind: "enum", name, path, optional, options }, override);
      }
      case "object": {
        // Object fields. Carve-out: skip the `blocks` array entirely — block
        // forms are owned by #9-#22, not by this issue. The path is still
        // navigable through `pages[]`; the `blocks` key is omitted so a
        // schema-walking consumer (or the form renderer) doesn't try to emit
        // controls for the block sub-tree.
        const shape = current.shape ?? {};
        const fields = Object.entries(shape)
          .filter(([childName]) => childName !== "blocks")
          .map(([childName, childSchema]) => nodeFor(childName, childSchema, [...path, childName]));
        return withMeta({ kind: "object", name, path, optional, fields }, override);
      }
      case "array": {
        const elementSchema = current.def.element;
        if (elementSchema === undefined) {
          throw new Error(`form-generator: array '${name}' has no element schema`);
        }
        const element = nodeFor("[]", elementSchema, [...path, "[]"]);
        return withMeta({ kind: "array", name, path, optional, element }, override);
      }
      default:
        // Fall back to a string node for anything we don't model yet (record,
        // literal, union, etc.). The site spine doesn't currently use these
        // at the leaves we render today; later issues can extend this switch.
        return withMeta({ kind: "string", name, path, optional }, override);
    }
  }

  // Top-level carve-out: `theme` is owned by ThemeForm (ADR 0043, CONTEXT.md
  // "Site spine: everything except pages[].blocks and theme"). We filter here
  // at the entry-point rather than inside `nodeFor`'s `case "object":` because
  // the carve is intentionally top-level-only — nested objects (e.g. block
  // data) may legitimately have a `theme` field and must not be silently
  // dropped. The `blocks` carve-out lives inside `nodeFor` and remains
  // universal-by-coincidence (only one `blocks` field exists in the spine).
  return Object.entries(introspect.shape)
    .filter(([name]) => name !== "theme")
    .map(([name, child]) => nodeFor(name, child, [name]));
}

/**
 * Build a `"custom"` node, carrying any label/tier overrides from the
 * matching path-keyed entry (if any). Schema-identity dispatch still
 * honours path-keyed label/tier because the path-keyed override is just
 * UI annotation; the renderer is what changes.
 */
function makeCustomNode(
  name: string,
  path: (string | number)[],
  optional: boolean,
  renderer: string,
  override: FieldOverride | undefined,
): FieldNode {
  const node: FieldNode = { kind: "custom", name, path, optional, renderer };
  if (override?.label !== undefined) {
    node.label = override.label;
  }
  if (override?.tier !== undefined) {
    node.tier = override.tier;
  }
  if (override?.hint !== undefined) {
    node.hint = override.hint;
  }
  return node;
}

/**
 * Attach optional `label` / `tier` from a path-keyed override to a default
 * (non-custom) node. Generic over the kind-specific node shape so the
 * caller doesn't need to widen the return type.
 */
function withMeta<TNode extends FieldNode>(
  node: TNode,
  override: FieldOverride | undefined,
): TNode {
  if (override === undefined) return node;
  if (override.label !== undefined) {
    node.label = override.label;
  }
  if (override.tier !== undefined) {
    node.tier = override.tier;
  }
  if (override.hint !== undefined) {
    node.hint = override.hint;
  }
  return node;
}
