import { z } from "zod";
import { AssetRefSchema } from "./asset-ref.js";

/**
 * eventList block — a list of single-occurrence events with optional
 * past-fade behaviour at render time.
 *
 * Per the PRD (story 34, Implementation Decisions → Block library) and
 * issue #22:
 *
 *  - Single occurrences only. No recurring rules (no RRULE/iCal), no `.ics`
 *    export — those are explicit out-of-scope items for v1.
 *  - Site-wide timezone (Europe/Bucharest in v1); per-event timezone
 *    overrides are out of scope. `startsAt`/`endsAt` therefore must be
 *    unambiguous ISO 8601 strings carrying either a `Z` (UTC) suffix or an
 *    explicit numeric offset (`+03:00`). A naive local-time string like
 *    `2026-06-15T18:00:00` is rejected — two clients in different timezones
 *    would read it differently when computing past-vs-future, so the
 *    deterministic-build + client-side-past-fade contract requires the
 *    offset to live on the data, not on the rendering environment.
 *  - `pastBehavior: "fade"` is the renderer's default; the past-fade JS
 *    consumer reads the actual value from a data attribute on the
 *    rendered block, so omitting it on the data simply uses the default.
 *  - `sortBy: "date-asc"` is the renderer's default; the sort happens at
 *    render time (deterministic) — the client-side script never reorders
 *    the DOM after first render.
 *
 * Block envelope follows the same shape as hero (#22 mirrors #46's
 * pattern): `{ id, type, version, data }` with `looseObject` everywhere
 * for the v1 forward-compatibility contract.
 */

const ISO_OFFSET_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/;

/**
 * Strict ISO 8601 datetime with a mandatory timezone designator.
 *
 * Accepts:
 *   - `2026-06-15T18:00:00Z`
 *   - `2026-06-15T18:00:00+03:00`
 *   - `2026-06-15T18:00:00.123+03:00`
 *
 * Rejects naive local times (`2026-06-15T18:00:00`) and free-form prose
 * (`tomorrow at noon`). The renderer uses `Date.parse` on the stored
 * string at render-or-script time — `Date.parse` honours the embedded
 * offset and returns an absolute UTC milliseconds value, which is the
 * comparison axis for past-vs-future regardless of the visitor's locale.
 */
const IsoDateTimeWithOffset = z.string().min(1).regex(ISO_OFFSET_RE, {
  message:
    "Datetime must be ISO 8601 with a timezone designator (e.g. 2026-06-15T18:00:00+03:00 or 2026-06-15T18:00:00Z).",
});

export const EventEntrySchema = z.looseObject({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  image: AssetRefSchema.optional(),
  imageAlt: z.string().optional(),
  startsAt: IsoDateTimeWithOffset,
  endsAt: IsoDateTimeWithOffset.optional(),
  location: z.string().optional(),
  url: z.string().optional(),
});

const SortBySchema = z.enum(["date-asc", "date-desc"]);
const PastBehaviorSchema = z.enum(["show", "fade", "hide"]);

export const EventListDataSchema = z.looseObject({
  title: z.string().optional(),
  intro: z.string().optional(),
  events: z.array(EventEntrySchema),
  sortBy: SortBySchema.optional(),
  pastBehavior: PastBehaviorSchema.optional(),
});

export const EventListBlockSchema = z.looseObject({
  id: z.string().min(1),
  type: z.literal("eventList"),
  version: z.literal(1),
  data: EventListDataSchema,
});

export const EVENT_LIST_BLOCK_VERSION = 1 as const;

/** Default render-time sort. */
export const DEFAULT_EVENT_SORT: z.infer<typeof SortBySchema> = "date-asc";

/** Default past-event behaviour at render time. */
export const DEFAULT_PAST_BEHAVIOR: z.infer<typeof PastBehaviorSchema> = "fade";

export type EventEntry = z.infer<typeof EventEntrySchema>;
export type EventListBlock = z.infer<typeof EventListBlockSchema>;
export type EventListData = z.infer<typeof EventListDataSchema>;
export type EventSortBy = z.infer<typeof SortBySchema>;
export type EventPastBehavior = z.infer<typeof PastBehaviorSchema>;
