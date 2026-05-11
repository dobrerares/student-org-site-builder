/**
 * Default-data factory for blocks added via the "Add Block" dialog.
 *
 * For every type in `@sosb/schema`'s `KnownBlockSchemas` registry the
 * factory returns a block that the schema's parser accepts (so the user
 * lands inside the editor with a valid block, not a half-shaped one). For
 * unknown types — the open-set forward-compat path — the factory emits a
 * generic envelope with an empty data object, matching the policy in
 * ADR 0002.
 *
 * Per ADR 0042 ("Default content policy: functional placeholders this
 * round"), the per-type defaults are *functional placeholders* — schema-
 * valid stubs the user immediately overwrites. We do not ship designed
 * copy here; that is a separate content pass.
 *
 * Owned by issue #27.
 */
import {
  ACTIVITIES_LIST_BLOCK_VERSION,
  CONTACT_CARD_BLOCK_VERSION,
  CTA_BANNER_BLOCK_VERSION,
  CUSTOM_HTML_BLOCK_VERSION,
  DOCUMENT_DOWNLOADS_BLOCK_VERSION,
  EMBED_BLOCK_VERSION,
  EVENT_LIST_BLOCK_VERSION,
  FAQ_BLOCK_VERSION,
  HERO_BLOCK_VERSION,
  IMAGE_GALLERY_BLOCK_VERSION,
  PARTNER_LOGOS_BLOCK_VERSION,
  QUOTE_BLOCK_VERSION,
  RICH_TEXT_BLOCK_VERSION,
  TEAM_GRID_BLOCK_VERSION,
  VALUE_LIST_BLOCK_VERSION,
  type BlockEnvelope,
} from "@sosb/schema";

/** Make a short, URL-safe id without depending on `crypto.randomUUID`. */
function makeBlockId(type: string): string {
  // Random part: 8 base36 chars from `Math.random()`. Determinism is not
  // required here (the renderer's determinism contract is over data, not
  // over freshly-created blocks).
  const rand = Math.random().toString(36).slice(2, 10);
  // Time component to avoid same-tick collisions inside a synchronous loop.
  const tick = Date.now().toString(36);
  return `blk_${type}_${tick}${rand}`;
}

interface DefaultBuilder {
  readonly version: number;
  readonly data: () => Record<string, unknown>;
}

/**
 * Per-type defaults table. Keys MUST match `KnownBlockSchemas`. New entries
 * land alongside their schema; the fallback path keeps the editor running
 * if a registry entry has no defaults entry.
 *
 * Entries are kept sorted alphabetically by key for readability.
 *
 * Asset-bearing blocks (documentDownloads, imageGallery, partnerLogos)
 * ship with an EMPTY items array (`images: []`, `partners: []`,
 * `files: []`). Per ADR 0044 Corollary 2 (no fake pipeline metadata in
 * snapshots) and T19 of the 2026-05-11 form-overrides plan, the previous
 * approach of seeding a placeholder `AssetRef`-shaped object with a
 * fabricated `hash: "placeholder"` is removed: the asset/document picker
 * (T10/T18) now owns the empty state, so a freshly-added block lets the
 * user pick "Add item" → "Add image/document" through the picker UI
 * without any fake metadata ever entering the data snapshot.
 */
const DEFAULT_BUILDERS: Record<string, DefaultBuilder> = {
  activitiesList: {
    version: ACTIVITIES_LIST_BLOCK_VERSION,
    data: () => ({
      title: "Activities",
      layout: "cards",
      items: [{ title: "New activity" }],
    }),
  },
  contactCard: {
    version: CONTACT_CARD_BLOCK_VERSION,
    data: () => ({
      address: "Address line",
      email: "contact@example.org",
      phone: "+40 700 000 000",
    }),
  },
  ctaBanner: {
    version: CTA_BANNER_BLOCK_VERSION,
    data: () => ({
      title: "Call-to-action title",
      subtitle: "Supporting text.",
      button: {
        label: "Action label",
        // Site-relative URL — no external dependency, passes the
        // safe-URL refinement on `CtaButtonSchema`.
        url: "/",
        style: "primary",
      },
    }),
  },
  customHTML: {
    version: CUSTOM_HTML_BLOCK_VERSION,
    data: () => ({
      // Inert placeholder markup. `sanitize: true` (the default) will pass
      // it through DOMPurify either way, but a `<p>` is safe regardless.
      html: "<p>Custom HTML goes here.</p>",
      sanitize: true,
    }),
  },
  documentDownloads: {
    version: DOCUMENT_DOWNLOADS_BLOCK_VERSION,
    data: () => ({
      title: "Documents",
      layout: "list",
      // Per ADR 0044 Corollary 2: ship an empty files array — the
      // document picker (T18) owns the empty state. The user adds files
      // through the BlockForm's array editor; each entry's `asset` slot
      // dispatches to `<DocumentPicker>` for upload, with no fabricated
      // metadata in the snapshot in the meantime.
      files: [],
    }),
  },
  embed: {
    version: EMBED_BLOCK_VERSION,
    data: () => ({
      provider: "youtube",
      // Canonical YouTube watch URL that matches `EMBED_URL_PATTERNS.youtube`.
      // The user replaces this with their own embed URL.
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      title: "Embed title",
    }),
  },
  eventList: {
    version: EVENT_LIST_BLOCK_VERSION,
    data: () => ({
      title: "Events",
      // Schema allows an empty events array, but we seed one so the user
      // can see the rendered shape and edit it. The datetime carries an
      // explicit offset, as the schema requires (no naive local times).
      events: [
        {
          id: "evt_placeholder",
          title: "New event",
          startsAt: "2099-01-01T18:00:00+02:00",
        },
      ],
    }),
  },
  faq: {
    version: FAQ_BLOCK_VERSION,
    data: () => ({
      title: "Frequently asked questions",
      items: [{ question: "Question?", answer: "Answer." }],
    }),
  },
  hero: {
    version: HERO_BLOCK_VERSION,
    data: () => ({ title: "New page" }),
  },
  imageGallery: {
    version: IMAGE_GALLERY_BLOCK_VERSION,
    data: () => ({
      title: "Gallery",
      layout: "grid",
      columns: 3,
      lightbox: true,
      // Per ADR 0044 Corollary 2: ship an empty images array — the asset
      // picker (T10) owns the empty state. The user adds images through
      // the BlockForm's array editor; each entry's `asset` slot
      // dispatches to `<AssetPicker>` for upload, with no fabricated
      // metadata in the snapshot in the meantime.
      images: [],
    }),
  },
  partnerLogos: {
    version: PARTNER_LOGOS_BLOCK_VERSION,
    data: () => ({
      title: "Partners",
      // Per ADR 0044 Corollary 2: ship an empty partners array — the
      // asset picker (T10) owns the empty state. The user adds partners
      // through the BlockForm's array editor; each entry's `logo` slot
      // dispatches to `<AssetPicker>` for upload, with no fabricated
      // metadata in the snapshot in the meantime.
      partners: [],
    }),
  },
  quote: {
    version: QUOTE_BLOCK_VERSION,
    data: () => ({
      text: "Quote text here.",
      author: "Author name",
    }),
  },
  richText: {
    version: RICH_TEXT_BLOCK_VERSION,
    data: () => ({ markdown: "## Heading\n\nParagraph text." }),
  },
  teamGrid: {
    version: TEAM_GRID_BLOCK_VERSION,
    data: () => ({
      title: "Team",
      columns: 3,
      // Schema requires `people.length >= 1`; each person needs name + role.
      people: [{ name: "Member name", role: "Role" }],
    }),
  },
  valueList: {
    version: VALUE_LIST_BLOCK_VERSION,
    data: () => ({
      title: "Our values",
      items: [{ label: "Value name", description: "Short description of this value." }],
      layout: "grid",
      columns: 3,
    }),
  },
};

/**
 * Build a default block envelope for the given registry key.
 *
 * Unknown types fall through to a generic `{ version: 1, data: {} }`
 * envelope so the editor stays operable when schemas land ahead of editor
 * defaults.
 */
export function defaultBlockFor(type: string): BlockEnvelope {
  const builder = DEFAULT_BUILDERS[type];
  if (builder !== undefined) {
    return {
      id: makeBlockId(type),
      type,
      version: builder.version,
      data: builder.data(),
    };
  }
  return {
    id: makeBlockId(type),
    type,
    version: 1,
    data: {},
  };
}
