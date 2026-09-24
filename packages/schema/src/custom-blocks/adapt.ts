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
 * The rules, per field of the *new* declaration:
 *
 *  - same name, same kind → the saved value is kept (recursively for groups
 *    and list entries);
 *  - same name, different kind → the saved value is removed and the field
 *    starts empty (a text box cannot show an image);
 *  - new field → empty, or the declared switch/choice default.
 *
 * Saved keys the new declaration does not name are kept when the *old*
 * declaration did not name them either (ADR 0002: unknown keys are preserved,
 * they may belong to a builder newer than this one) and removed when it did:
 * that is precisely a field the developer took away.
 *
 * "Content" for the purposes of the removal list is anything the author could
 * have entered: a non-empty string, a number, a switch, a choice, a link, an
 * image, a document, a non-empty document, a non-empty list, a group with any
 * of those inside.
 */

import type { BlockEnvelope } from "../blocks/index.js";
import type { Site } from "../site.js";
import {
  localizedText,
  type CustomBlockDeclaration,
  type CustomBlockField,
} from "./declaration.js";
import { customBlockFieldIsEmpty } from "./check-data.js";
import { defaultCustomBlockGroup } from "./defaults.js";

/** One piece of saved content an update would remove. */
export interface RemovedCustomBlockContent {
  readonly blockId: string;
  readonly blockType: string;
  /** Where the Block lives, for the confirmation list. */
  readonly document: { readonly kind: "page" | "article"; readonly title: string };
  /** Path into the Block's `data`. */
  readonly path: readonly (string | number)[];
  /** The old field's default label, or the key when the old declaration did not know it. */
  readonly label: string;
  /** A short, human-readable rendering of the value. */
  readonly preview: string;
}

export interface AdaptedCustomBlockData {
  readonly data: Record<string, unknown>;
  readonly removed: readonly Omit<
    RemovedCustomBlockContent,
    "blockId" | "blockType" | "document"
  >[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A one-line preview of a value for the confirmation list. */
export function previewCustomBlockValue(value: unknown): string {
  if (typeof value === "string") return value.length > 60 ? `${value.slice(0, 57)}…` : value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return `${value.length} ${value.length === 1 ? "entry" : "entries"}`;
  if (isRecord(value)) {
    if (Array.isArray(value["content"])) return "formatted text";
    if (typeof value["path"] === "string") {
      const name = value["originalName"];
      return typeof name === "string"
        ? name
        : `file ${String(value["path"]).split("/").pop() ?? ""}`;
    }
    const kind = value["kind"];
    if (kind === "external") return String(value["href"] ?? "link");
    if (kind === "page") return "link to a page";
    if (kind === "article") return "link to an article";
    return "a group of values";
  }
  return "";
}

function fieldLabel(field: CustomBlockField | undefined, key: string): string {
  return field === undefined ? key : localizedText(field.label, "en");
}

/** Does this value hold anything the author would miss? */
function holdsContent(field: CustomBlockField | undefined, value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (field !== undefined) return !customBlockFieldIsEmpty(field, value);
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (isRecord(value)) return Object.keys(value).length > 0;
  return true;
}

function adaptGroup(
  oldFields: readonly CustomBlockField[] | undefined,
  newFields: readonly CustomBlockField[],
  saved: Record<string, unknown>,
  base: readonly (string | number)[],
  removed: Omit<RemovedCustomBlockContent, "blockId" | "blockType" | "document">[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const oldByName = new Map((oldFields ?? []).map((f) => [f.name, f] as const));
  const newByName = new Map(newFields.map((f) => [f.name, f] as const));

  for (const field of newFields) {
    const value = saved[field.name];
    const previous = oldByName.get(field.name);
    const path = [...base, field.name];
    if (value === undefined) {
      continue;
    }
    // A saved value is kept when it already is the shape the new field
    // stores. Checking the value rather than the old declaration means data
    // saved without an old declaration (a hand-edited archive) is treated
    // the same way as data the builder wrote.
    if (field.kind === "group") {
      if (isRecord(value)) {
        out[field.name] = adaptGroup(
          previous?.kind === "group" ? previous.fields : undefined,
          field.fields,
          value,
          path,
          removed,
        );
      } else if (holdsContent(previous, value)) {
        removed.push({
          path,
          label: fieldLabel(previous, field.name),
          preview: previewCustomBlockValue(value),
        });
      }
      continue;
    }
    if (field.kind === "list") {
      if (Array.isArray(value)) {
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
      } else if (holdsContent(previous, value)) {
        removed.push({
          path,
          label: fieldLabel(previous, field.name),
          preview: previewCustomBlockValue(value),
        });
      }
      continue;
    }
    if (customBlockFieldIsEmpty(field, value) && holdsContent(previous, value)) {
      // Not empty for the old field, empty for the new one: the kind changed.
      removed.push({
        path,
        label: fieldLabel(previous, field.name),
        preview: previewCustomBlockValue(value),
      });
      continue;
    }
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
        label: fieldLabel(previous, key),
        preview: previewCustomBlockValue(value),
      });
    }
  }

  // Switch and choice defaults apply only to fields the saved data does not
  // have at all — new fields — never over saved content.
  for (const [key, value] of Object.entries(defaultCustomBlockGroup(newFields))) {
    if (!(key in out) && !(key in saved)) out[key] = value;
  }
  return out;
}

/** Adapt one Block's `data` from `previous` (if known) to `next`. */
export function adaptCustomBlockData(
  previous: CustomBlockDeclaration | undefined,
  next: CustomBlockDeclaration,
  data: unknown,
): AdaptedCustomBlockData {
  const removed: Omit<RemovedCustomBlockContent, "blockId" | "blockType" | "document">[] = [];
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
 * can be named by its old label. A type with no previous declaration is
 * adapted conservatively: nothing is reported removed except values the new
 * kind cannot hold.
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
      const result = adaptCustomBlockData(previousByType.get(block.type), declaration, block.data);
      for (const entry of result.removed) {
        removed.push({ blockId: block.id, blockType: block.type, document, ...entry });
      }
      const dataChanged = JSON.stringify(result.data) !== JSON.stringify(block.data);
      const versionChanged = block.version !== declaration.version;
      if (!dataChanged && !versionChanged) return block;
      changedBlocks += 1;
      return { ...block, version: declaration.version, data: result.data };
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
