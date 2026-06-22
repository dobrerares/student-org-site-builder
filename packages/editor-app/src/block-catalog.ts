/**
 * Block library catalog — the data source for the "Add Block" dialog.
 *
 * The catalog is derived **dynamically** from `@sosb/schema`'s
 * `KnownBlockSchemas` registry. Adding a new block type to the registry
 * causes it to appear in the catalog without changing this file. The
 * per-type metadata table (`BLOCK_METADATA`) supplies category + label +
 * description for the types we know about today; types that land in the
 * registry without a metadata entry fall back to a humanised label and the
 * `optional` category, so a half-landed block (schema before editor copy)
 * is still surfaced rather than silently dropped.
 *
 * Owned by issue #27. Per the AC the catalog is categorised
 * (mandatory / optional / advanced) and searchable.
 */

import { KnownBlockSchemas } from "@sosb/schema";

export type BlockCategory = "mandatory" | "optional" | "advanced";

export interface BlockCatalogEntry {
  /** The schema-registry key (e.g. `"hero"`). */
  readonly type: string;
  /** Section the entry appears in within the dialog. */
  readonly category: BlockCategory;
  /** Human-readable label shown in the dialog. */
  readonly label: string;
  /** One-line description shown beneath the label. */
  readonly description: string;
}

export interface BlockCatalogGroup {
  readonly category: BlockCategory;
  readonly entries: BlockCatalogEntry[];
}

export interface BlockCatalog {
  /** Every entry, ordered by category then label. */
  readonly entries: BlockCatalogEntry[];
  /** Entries pre-grouped by category. Always 3 groups in fixed order. */
  readonly groups: BlockCatalogGroup[];
  /** Look up a single entry. Used in tests for unknown-fallback assertions. */
  entryFor(type: string): BlockCatalogEntry;
}

/**
 * Static metadata for the block types we ship today. Keys MUST match the
 * `KnownBlockSchemas` registry. New entries land in this table alongside
 * their schema; the fallback path keeps the editor running if a registry
 * entry lacks metadata.
 *
 * The PRD calls out the full v1 block matrix (#9-#22). All 15 v1 blocks now
 * have entries here; future blocks should land their metadata in the same
 * additive shape (the dialog-fallback path stays as a forward-compat safety
 * net only).
 *
 * Entries are kept sorted alphabetically by key for readability.
 */
const BLOCK_METADATA: Record<
  string,
  { readonly category: BlockCategory; readonly label: string; readonly description: string }
> = {
  activitiesList: {
    category: "optional",
    label: "Activities list",
    description: "Show recurring projects, services, or activities with optional images.",
  },
  contactCard: {
    category: "mandatory",
    label: "Contact card",
    description: "Show address, email, phone, social links, and an optional map.",
  },
  ctaBanner: {
    category: "optional",
    label: "Action banner",
    description: "Add a short message with one clear button.",
  },
  customHTML: {
    category: "advanced",
    label: "Custom code embed",
    description: "For trusted embed code that does not fit the ready-made sections.",
  },
  documentDownloads: {
    category: "optional",
    label: "Document downloads",
    description: "Add files visitors can download, such as PDFs, forms, or archives.",
  },
  embed: {
    category: "advanced",
    label: "Embed",
    description: "Add media from a supported service, such as video or audio.",
  },
  eventList: {
    category: "optional",
    label: "Event list",
    description: "List events with dates, locations, and short details.",
  },
  faq: {
    category: "optional",
    label: "Questions and answers",
    description: "Add common questions with their answers.",
  },
  hero: {
    category: "mandatory",
    label: "Page header",
    description: "Start a page with a title, subtitle, and optional image.",
  },
  imageGallery: {
    category: "optional",
    label: "Image gallery",
    description: "Show a set of photos with optional captions.",
  },
  partnerLogos: {
    category: "optional",
    label: "Partner logos",
    description: "Show sponsor or partner logos with optional links.",
  },
  quote: {
    category: "optional",
    label: "Quote",
    description: "Highlight a quote with an optional name, role, and photo.",
  },
  richText: {
    category: "optional",
    label: "Text section",
    description: "Add longer text with headings, lists, and links.",
  },
  siteFooter: {
    category: "optional",
    label: "Site footer",
    description: "Show contact links and membership or umbrella-organisation credit.",
  },
  teamGrid: {
    category: "optional",
    label: "Team grid",
    description: "Photo grid of team members with names, roles, optional bios, and social links.",
  },
  valueList: {
    category: "optional",
    label: "Value list",
    description: "Show values, principles, or benefits with optional icons.",
  },
};

const CATEGORY_ORDER: readonly BlockCategory[] = ["mandatory", "optional", "advanced"];

/**
 * Render an unknown camel/Pascal-case block type as a humanised label.
 *
 * `partnerLogos` -> `Partner logos`, `customHTML` -> `Custom html`,
 * `faq` -> `Faq`. Good enough for the fallback path; explicit metadata
 * always wins.
 */
function humanise(type: string): string {
  if (type.length === 0) return type;
  const spaced = type
    // insert a space between a lowercase/number boundary and an uppercase letter
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    // collapse runs of uppercase preserved as e.g. "HTML" into "Html"
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function entryForType(type: string): BlockCatalogEntry {
  const meta = BLOCK_METADATA[type];
  if (meta !== undefined) {
    return { type, ...meta };
  }
  return {
    type,
    category: "optional",
    label: humanise(type),
    description: `Block type "${type}".`,
  };
}

/**
 * Build a catalog from the live schema registry. The catalog is a fresh
 * object on each call; callers can memoise it as needed.
 */
export function buildBlockCatalog(): BlockCatalog {
  const types = Object.keys(KnownBlockSchemas);
  const entries = types.map(entryForType).sort((a, b) => {
    const byCategory = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    if (byCategory !== 0) return byCategory;
    return a.label.localeCompare(b.label);
  });

  const groups: BlockCatalogGroup[] = CATEGORY_ORDER.map((category) => ({
    category,
    entries: entries.filter((entry) => entry.category === category),
  }));

  return {
    entries,
    groups,
    entryFor: entryForType,
  };
}
