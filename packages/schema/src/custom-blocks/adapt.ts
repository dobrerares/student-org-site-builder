/**
 * Adapting saved Custom Block data to an updated declaration (ADR 0055;
 * issue-106 plan, "author-controlled extension updates").
 *
 * When a package is updated to a version whose fields changed, saved data has
 * to follow: fields that remain keep their content, new fields start empty,
 * and fields that are gone take their content with them. The last case is the
 * one an author must see before it happens, so this module does two things
 * separately — it computes what *would* be removed, and it produces the
 * adapted Site — and the editor shows the first before applying the second.
 *
 * The rules are driven by the two declarations, never guessed from the shape
 * of a value. Per field of the *new* declaration:
 *
 *  - the old declaration names it with the same kind → the saved value is
 *    kept (recursively for groups and list entries);
 *  - the old declaration names it with a different kind → the saved value is
 *    removed and the field starts empty (a text box cannot show an image);
 *  - the old declaration does not name it → the saved value, if any, is kept
 *    exactly as it was (ADR 0002 — it may belong to a builder newer than this
 *    one, and validation reports a shape the field cannot show); a field with
 *    nothing saved starts empty, or at its switch/choice default.
 *
 * Saved keys the new declaration does not name are kept when the old
 * declaration did not name them either, and removed when it did: that is
 * precisely a field the developer took away.
 *
 * Without an old declaration — the type's first import into a Site that
 * already holds Blocks of it, typically an archive whose package was lost —
 * nothing is removed and nothing is filled in. There is no outgoing package
 * to keep a recovery copy of, so no removal may be offered; the data version
 * is only moved *up* to the declaration's, never down (a Block saved by a
 * newer package stays unavailable until that package is imported).
 *
 * "Content" for the purposes of the removal list is anything the author could
 * have entered: a non-empty string, a number, a switch, a choice, a link, an
 * image, a document, a non-empty rich-text document, a non-empty list, a
 * group with any of those inside — and any value the old field cannot even
 * hold, which is still the author's.
 */

import type { BlockEnvelope } from "../blocks/index.js";
import type { Site } from "../site.js";
import type { CustomBlockDeclaration, CustomBlockField, LocalizedText } from "./declaration.js";
import { customBlockFieldHasShape, customBlockFieldIsEmpty } from "./check-data.js";
import { defaultCustomBlockGroup } from "./defaults.js";

/**
 * A short rendering of a value for the confirmation list. Structured rather
 * than a sentence so the editor can put it in the author's language; the
 * `text` case carries what the author typed (or an address, or a file name),
 * which needs no translation.
 */
export type CustomBlockValuePreview =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "boolean"; readonly value: boolean }
  | { readonly kind: "entries"; readonly count: number }
  | { readonly kind: "richText" }
  | { readonly kind: "link"; readonly target: "page" | "article" }
  | { readonly kind: "group" }
  | { readonly kind: "none" };

/** One piece of saved content an update would remove. */
export interface RemovedCustomBlockContent {
  readonly blockId: string;
  readonly blockType: string;
  /** The type's editing label, from the outgoing declaration. */
  readonly blockLabel: LocalizedText;
  /** Where the Block lives, for the confirmation list. */
  readonly document: { readonly kind: "page" | "article"; readonly title: string };
  /** Path into the Block's `data`. */
  readonly path: readonly (string | number)[];
  /** The old field's label, in the declaration's languages. */
  readonly label: LocalizedText;
  readonly preview: CustomBlockValuePreview;
}

type RemovedEntry = Omit<
  RemovedCustomBlockContent,
  "blockId" | "blockType" | "blockLabel" | "document"
>;

export interface AdaptedCustomBlockData {
  readonly data: Record<string, unknown>;
  readonly removed: readonly RemovedEntry[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Structural equality over JSON-shaped values, indifferent to key order. */
export function sameCustomBlockData(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((value, index) => sameCustomBlockData(value, b[index]))
    );
  }
  if (isRecord(a) && isRecord(b)) {
    const keys = Object.keys(a);
    return (
      keys.length === Object.keys(b).length &&
      keys.every((key) => key in b && sameCustomBlockData(a[key], b[key]))
    );
  }
  return false;
}

/** A preview of a value for the confirmation list. */
export function previewCustomBlockValue(value: unknown): CustomBlockValuePreview {
  if (typeof value === "string") {
    return { kind: "text", text: value.length > 60 ? `${value.slice(0, 57)}…` : value };
  }
  if (typeof value === "number") return { kind: "text", text: String(value) };
  if (typeof value === "boolean") return { kind: "boolean", value };
  if (Array.isArray(value)) return { kind: "entries", count: value.length };
  if (isRecord(value)) {
    if (Array.isArray(value["content"])) return { kind: "richText" };
    if (typeof value["path"] === "string") {
      const name = value["originalName"];
      return {
        kind: "text",
        text: typeof name === "string" ? name : (value["path"].split("/").pop() ?? ""),
      };
    }
    const kind = value["kind"];
    if (kind === "external") {
      return { kind: "text", text: typeof value["href"] === "string" ? value["href"] : "" };
    }
    if (kind === "page") return { kind: "link", target: "page" };
    if (kind === "article") return { kind: "link", target: "article" };
    return { kind: "group" };
  }
  return { kind: "none" };
}

/** Anything at all, by the loosest reading — for a value the old field cannot judge. */
function holdsAnything(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (isRecord(value)) return Object.keys(value).length > 0;
  return true;
}

/** Does this value hold anything the author would miss? */
function holdsContent(field: CustomBlockField, value: unknown): boolean {
  if (!customBlockFieldIsEmpty(field, value)) return true;
  // A value the old field cannot even hold is "empty" by the field's rule but
  // is still the author's; it is listed rather than dropped in silence.
  return !customBlockFieldHasShape(field, value) && holdsAnything(value);
}

function adaptGroup(
  oldFields: readonly CustomBlockField[] | undefined,
  newFields: readonly CustomBlockField[],
  saved: Record<string, unknown>,
  base: readonly (string | number)[],
  removed: RemovedEntry[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const oldByName = new Map((oldFields ?? []).map((f) => [f.name, f] as const));
  const newByName = new Map(newFields.map((f) => [f.name, f] as const));

  for (const field of newFields) {
    const value = saved[field.name];
    if (value === undefined) continue;
    const previous = oldByName.get(field.name);
    const path = [...base, field.name];

    if (previous !== undefined && previous.kind !== field.kind) {
      // The kind changed: the old field's content has no place in the new one.
      if (holdsContent(previous, value)) {
        removed.push({ path, label: previous.label, preview: previewCustomBlockValue(value) });
      }
      continue;
    }
    if (field.kind === "group" && isRecord(value)) {
      out[field.name] = adaptGroup(
        previous?.kind === "group" ? previous.fields : undefined,
        field.fields,
        value,
        path,
        removed,
      );
      continue;
    }
    if (field.kind === "list" && Array.isArray(value)) {
      out[field.name] = value.map((entry, index) =>
        isRecord(entry)
          ? adaptGroup(
              previous?.kind === "list" ? previous.item.fields : undefined,
              field.item.fields,
              entry,
              [...path, index],
              removed,
            )
          : entry,
      );
      continue;
    }
    // Same kind as before, or a key the old declaration did not name: kept
    // exactly as saved (ADR 0002). A shape the field cannot show is reported
    // by validation, never removed here.
    out[field.name] = value;
  }

  // Keys the new declaration does not name.
  for (const [key, value] of Object.entries(saved)) {
    if (newByName.has(key)) continue;
    const previous = oldByName.get(key);
    if (previous === undefined) {
      // Unknown to both declarations: preserved (ADR 0002).
      out[key] = value;
      continue;
    }
    if (holdsContent(previous, value)) {
      removed.push({
        path: [...base, key],
        label: previous.label,
        preview: previewCustomBlockValue(value),
      });
    }
  }

  // Switch and choice defaults apply only to fields this update *introduces*
  // — declared now, unknown to the previous declaration — and only when the
  // saved data has nothing there. A field both versions declare keeps what
  // the author left, including "unset"; an appearance-only update therefore
  // writes nothing at all. Without a previous declaration nothing is new, so
  // nothing is filled in.
  if (oldFields !== undefined) {
    for (const [key, value] of Object.entries(defaultCustomBlockGroup(newFields))) {
      if (!oldByName.has(key) && !(key in out) && !(key in saved)) out[key] = value;
    }
  }
  return out;
}

/** Adapt one Block's `data` from `previous` (if known) to `next`. */
export function adaptCustomBlockData(
  previous: CustomBlockDeclaration | undefined,
  next: CustomBlockDeclaration,
  data: unknown,
): AdaptedCustomBlockData {
  const removed: RemovedEntry[] = [];
  const saved = isRecord(data) ? data : {};
  const adapted = adaptGroup(previous?.fields, next.fields, saved, [], removed);
  return { data: adapted, removed };
}

export interface AdaptedSite {
  readonly site: Site;
  readonly removed: readonly RemovedCustomBlockContent[];
  /** How many Block envelopes changed (data or version). */
  readonly changedBlocks: number;
}

/**
 * Adapt every Block of the given types across the Site — Pages and Articles,
 * Drafts included, because a Draft's content is still the author's — and stamp
 * each envelope with the new data version.
 *
 * `previous` supplies the outgoing declarations by type, so a removed field
 * can be named by its old label. A type with no previous declaration is left
 * as it is, apart from a data version *below* the declaration's being moved
 * up to it; a Block saved by a newer package than the one being imported is
 * not touched at all, so it stays unavailable (`data-newer`) rather than
 * being silently reinterpreted.
 */
export function adaptSiteToDeclarations(
  site: Site,
  next: readonly CustomBlockDeclaration[],
  previous: readonly CustomBlockDeclaration[] = [],
): AdaptedSite {
  const nextByType = new Map(next.map((d) => [d.type, d] as const));
  const previousByType = new Map(previous.map((d) => [d.type, d] as const));
  const removed: RemovedCustomBlockContent[] = [];
  let changedBlocks = 0;

  const adaptBlocks = (
    blocks: readonly BlockEnvelope[],
    document: RemovedCustomBlockContent["document"],
  ): BlockEnvelope[] =>
    blocks.map((block) => {
      const declaration = nextByType.get(block.type);
      if (declaration === undefined) return block;
      const outgoing = previousByType.get(block.type);
      if (outgoing === undefined && block.version > declaration.version) return block;
      const result = adaptCustomBlockData(outgoing, declaration, block.data);
      for (const entry of result.removed) {
        removed.push({
          blockId: block.id,
          blockType: block.type,
          blockLabel: (outgoing ?? declaration).label,
          document,
          ...entry,
        });
      }
      const dataChanged = !sameCustomBlockData(result.data, block.data);
      const versionChanged = block.version !== declaration.version;
      if (!dataChanged && !versionChanged) return block;
      changedBlocks += 1;
      return {
        ...block,
        version: declaration.version,
        data: dataChanged ? result.data : block.data,
      };
    });

  const pages = site.pages.map((page) => ({
    ...page,
    blocks: adaptBlocks(page.blocks, { kind: "page", title: page.navLabel }),
  }));
  const articles = (site.articles ?? []).map((article) => ({
    ...article,
    blocks: adaptBlocks(article.blocks, { kind: "article", title: article.title }),
  }));

  const adapted: Site = { ...site, pages };
  if (site.articles !== undefined) (adapted as { articles: typeof articles }).articles = articles;
  return { site: changedBlocks === 0 ? site : adapted, removed, changedBlocks };
}
