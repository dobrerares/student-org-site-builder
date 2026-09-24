/**
 * Starting data for a new Custom Block (issue-106 plan, "defaults for new
 * Custom Blocks"): empty text, no images, no list entries; only choices and
 * switches may carry a developer-supplied starting value. These defaults
 * describe *new* Blocks and new list entries — they are never applied to
 * saved content.
 */

import type { CustomBlockDeclaration, CustomBlockField } from "./declaration.js";

/** Default data for a group of fields: only switches and choices with a declared default. */
export function defaultCustomBlockGroup(
  fields: readonly CustomBlockField[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    switch (field.kind) {
      case "boolean":
        if (field.default !== undefined) out[field.name] = field.default;
        break;
      case "choice":
        if (field.default !== undefined) out[field.name] = field.default;
        break;
      case "group": {
        const inner = defaultCustomBlockGroup(field.fields);
        if (Object.keys(inner).length > 0) out[field.name] = inner;
        break;
      }
      default:
        // text, richText, number, link, image, document, list: start empty.
        break;
    }
  }
  return out;
}

/** The `data` of a freshly added Block of this type. */
export function defaultCustomBlockData(
  declaration: CustomBlockDeclaration,
): Record<string, unknown> {
  return defaultCustomBlockGroup(declaration.fields);
}

/**
 * Find the field a data path addresses. Numeric segments step into list
 * entries; the returned field is the one the last segment names.
 */
export function customBlockFieldAt(
  declaration: CustomBlockDeclaration,
  path: readonly (string | number)[],
): CustomBlockField | undefined {
  let fields: readonly CustomBlockField[] = declaration.fields;
  let current: CustomBlockField | undefined;
  for (const segment of path) {
    if (typeof segment === "number" || segment === "[]") {
      if (current?.kind !== "list") return undefined;
      fields = current.item.fields;
      current = undefined;
      continue;
    }
    current = fields.find((f) => f.name === segment);
    if (current === undefined) return undefined;
    if (current.kind === "group") fields = current.fields;
  }
  return current;
}

/**
 * An empty new entry for the list at `path` — "Add partner presents an empty
 * name, image, and link with clear labels" — carrying only the entry's own
 * switch and choice defaults.
 */
export function defaultCustomBlockListEntry(
  declaration: CustomBlockDeclaration,
  path: readonly (string | number)[],
): Record<string, unknown> {
  const field = customBlockFieldAt(declaration, path);
  if (field === undefined || field.kind !== "list") return {};
  return defaultCustomBlockGroup(field.item.fields);
}
