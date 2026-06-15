/** @jsxImportSource preact */
import type { EventEntry, EventListBlock, EventPastBehavior, EventSortBy } from "@sosb/schema";
import { DEFAULT_EVENT_SORT, DEFAULT_PAST_BEHAVIOR } from "@sosb/schema";
import { assetRefAlt, assetRefPath } from "../asset-ref-path.js";
import type { AssetUrlForPath } from "../asset-url.js";
import { resolveAssetUrl } from "../asset-url.js";

/**
 * eventList renderer — structural HTML.
 *
 * Layout:
 *
 *   <section data-block="event-list" data-past-behavior=...>
 *     [<h2 class="event-list__title">title</h2>]
 *     [<p class="event-list__intro">intro</p>]
 *     <ol class="event-list__items">
 *       <li>
 *         <article data-event-id data-starts-at [data-ends-at]>
 *           <h3>title</h3>
 *           <time datetime>...</time>
 *           [optional location/description/image/url]
 *         </article>
 *       </li>
 *       ...
 *     </ol>
 *   </section>
 *
 * Sort happens at render time using lexicographic comparison of the
 * timezone-bearing ISO strings — the schema already enforces a real offset
 * on every `startsAt`, so two strings whose absolute UTC instants differ
 * also differ lexicographically when both are normalised to the same
 * minute precision. For mixed-timezone inputs we fall back to `Date.parse`
 * (still deterministic; absolute UTC milliseconds), which the test suite
 * exercises.
 *
 * The past-fade behaviour is **client-side only** — the renderer's output
 * is the same whether the visitor's "now" is before, during, or after the
 * events. Determinism contract holds: no `Date.now()` is called at render
 * time, no per-build "now" is baked in.
 */

function compareForSort(a: EventEntry, b: EventEntry, dir: EventSortBy): number {
  const at = Date.parse(a.startsAt);
  const bt = Date.parse(b.startsAt);
  // If either is NaN (schema lets through unknown shapes via looseObject),
  // fall back to string comparison so the sort is still total and stable.
  if (Number.isNaN(at) || Number.isNaN(bt)) {
    if (a.startsAt < b.startsAt) return dir === "date-asc" ? -1 : 1;
    if (a.startsAt > b.startsAt) return dir === "date-asc" ? 1 : -1;
    return 0;
  }
  if (at < bt) return dir === "date-asc" ? -1 : 1;
  if (at > bt) return dir === "date-asc" ? 1 : -1;
  return 0;
}

function sortedEvents(events: readonly EventEntry[], dir: EventSortBy): EventEntry[] {
  // toSorted would be cleaner but we keep `slice` for ES2022 floor compat.
  return events.slice().sort((a, b) => compareForSort(a, b, dir));
}

function readEventField(entry: unknown, key: string): string | undefined {
  if (typeof entry !== "object" || entry === null) return undefined;
  const v = (entry as Record<string, unknown>)[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function EventCard(props: {
  entry: EventEntry;
  assetUrlForPath: AssetUrlForPath | undefined;
  lang: string;
}): preact.JSX.Element {
  const { entry } = props;
  const description = readEventField(entry, "description");
  const image = assetRefPath(entry.image);
  const imageAlt =
    readEventField(entry, "imageAlt") ?? (image !== undefined ? assetRefAlt(entry.image) : "");
  const location = readEventField(entry, "location");
  const url = readEventField(entry, "url");
  const endsAt = readEventField(entry, "endsAt");

  const articleProps: Record<string, string> = {
    "data-event-id": entry.id,
    "data-starts-at": entry.startsAt,
  };
  if (endsAt !== undefined) articleProps["data-ends-at"] = endsAt;

  return (
    <article {...articleProps}>
      <h3 class="event-list__item-title">{entry.title}</h3>
      <time class="event-list__item-time" datetime={entry.startsAt}>
        {formatEventTimeRange(entry.startsAt, endsAt, props.lang)}
      </time>
      {location !== undefined && <p class="event-list__item-location">{location}</p>}
      {description !== undefined && <p class="event-list__item-description">{description}</p>}
      {image !== undefined && (
        <div class="event-list__item-media">
          <img src={resolveAssetUrl(image, props.assetUrlForPath)} alt={imageAlt} loading="lazy" />
        </div>
      )}
      {url !== undefined && (
        <a class="event-list__item-link" href={url}>
          Detalii
        </a>
      )}
    </article>
  );
}

export function EventList(props: {
  block: EventListBlock;
  assetUrlForPath?: AssetUrlForPath | undefined;
  lang?: string | undefined;
}): preact.JSX.Element | null {
  const { id, data } = props.block;
  const lang = props.lang ?? "ro";

  const eventsRaw = Array.isArray(data.events) ? (data.events as EventEntry[]) : [];

  // Empty-state suppression: an eventList with no events renders nothing
  // rather than an empty styled container. The past-fade <script> is still
  // gated separately by the page-shell (`pageHasEventList`); a suppressed,
  // event-less block contributes no DOM for that script to act on.
  if (eventsRaw.length === 0) return null;

  const sortBy =
    data.sortBy === "date-asc" || data.sortBy === "date-desc" ? data.sortBy : DEFAULT_EVENT_SORT;
  const pastBehavior: EventPastBehavior =
    data.pastBehavior === "show" || data.pastBehavior === "fade" || data.pastBehavior === "hide"
      ? data.pastBehavior
      : DEFAULT_PAST_BEHAVIOR;

  const events = sortedEvents(eventsRaw, sortBy);

  const headingId =
    typeof data.title === "string" && data.title.length > 0 ? `${id}__title` : undefined;

  return (
    <section
      data-block="event-list"
      data-block-id={id}
      data-past-behavior={pastBehavior}
      aria-labelledby={headingId}
    >
      {typeof data.title === "string" && data.title.length > 0 && (
        <h2 id={headingId} class="event-list__title">
          {data.title}
        </h2>
      )}
      {typeof data.intro === "string" && data.intro.length > 0 && (
        <p class="event-list__intro">{data.intro}</p>
      )}
      <ol class="event-list__items">
        {events.map((entry) => (
          <li key={entry.id} class="event-list__item">
            <EventCard entry={entry} assetUrlForPath={props.assetUrlForPath} lang={lang} />
          </li>
        ))}
      </ol>
    </section>
  );
}

interface LocalDateTimeParts {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
}

const ISO_LOCAL_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

const MONTH_LABELS: Record<"ro" | "en", readonly string[]> = {
  ro: [
    "ian.",
    "feb.",
    "mar.",
    "apr.",
    "mai",
    "iun.",
    "iul.",
    "aug.",
    "sept.",
    "oct.",
    "nov.",
    "dec.",
  ],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"],
};

function parseLocalDateTime(value: string): LocalDateTimeParts | null {
  const match = ISO_LOCAL_DATE_TIME.exec(value);
  if (match === null) return null;
  const [, year, month, day, hour, minute] = match;
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined
  ) {
    return null;
  }
  return { year, month, day, hour, minute };
}

function languageFamily(lang: string): "ro" | "en" {
  return lang.toLowerCase().startsWith("en") ? "en" : "ro";
}

function formatDate(parts: LocalDateTimeParts, lang: string): string {
  const family = languageFamily(lang);
  const monthIndex = Number.parseInt(parts.month, 10) - 1;
  const month = MONTH_LABELS[family][monthIndex] ?? parts.month;
  const day = String(Number.parseInt(parts.day, 10));
  if (family === "en") return `${month} ${day}, ${parts.year}`;
  return `${day} ${month} ${parts.year}`;
}

function formatTime(parts: LocalDateTimeParts): string {
  return `${parts.hour}:${parts.minute}`;
}

function sameLocalDate(a: LocalDateTimeParts, b: LocalDateTimeParts): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

function formatEventDateTime(value: string, lang: string): string {
  const parts = parseLocalDateTime(value);
  if (parts === null) return value;
  return `${formatDate(parts, lang)}, ${formatTime(parts)}`;
}

function formatEventTimeRange(startsAt: string, endsAt: string | undefined, lang: string): string {
  const start = parseLocalDateTime(startsAt);
  if (start === null) return startsAt;
  if (endsAt === undefined) return `${formatDate(start, lang)}, ${formatTime(start)}`;

  const end = parseLocalDateTime(endsAt);
  if (end === null) return formatEventDateTime(startsAt, lang);
  if (sameLocalDate(start, end)) {
    return `${formatDate(start, lang)}, ${formatTime(start)}-${formatTime(end)}`;
  }
  return `${formatEventDateTime(startsAt, lang)} - ${formatEventDateTime(endsAt, lang)}`;
}
