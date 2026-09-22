/**
 * Public-site copy and date formatting for Articles.
 *
 * Two constraints shape this module:
 *
 *  1. **Determinism.** No `Intl`, no `toLocaleDateString`, no `Date` at all.
 *     `Intl` output varies with the host's ICU build, which would make the
 *     golden files environment-dependent and break the Node-vs-browser parity
 *     contract in ADR 0032. Dates are formatted by table lookup instead.
 *  2. **Visitor-facing language.** This is the *org's* website, not the
 *     builder UI, so the few renderer-supplied strings follow the rendered
 *     page's language rather than the editor locale. `@sosb/i18n` deliberately
 *     stays out of the renderer — it carries builder strings and its catalog
 *     is chosen by the author's browser, which has nothing to do with the
 *     language a given exported page is written in.
 *
 * The `ro`/`en` split and the abbreviated month labels match `event-list.tsx`,
 * so a Site with both an event list and an article list reads consistently.
 */

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

const COPY = {
  ro: {
    emptyList: "Încă nu există articole.",
    relatedTitle: "Articole similare",
    tagsLabel: "Etichete",
    languageLabel: "Limbă",
    publishedOn: "Publicat pe",
    movedHeading: "Această pagină s-a mutat.",
    movedLink: "Continuă către articol",
  },
  en: {
    emptyList: "No articles yet.",
    relatedTitle: "Related articles",
    tagsLabel: "Tags",
    languageLabel: "Language",
    publishedOn: "Published on",
    movedHeading: "This page has moved.",
    movedLink: "Continue to the article",
  },
} as const;

export type ArticleCopyKey = keyof (typeof COPY)["en"];

function languageFamily(lang: string): "ro" | "en" {
  return lang.toLowerCase().startsWith("en") ? "en" : "ro";
}

/** Visitor-facing string for `key`, in the rendered page's language family. */
export function articleCopy(lang: string, key: ArticleCopyKey): string {
  return COPY[languageFamily(lang)][key];
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Format a `YYYY-MM-DD` publication date for display.
 *
 * Unparseable input is returned verbatim rather than replaced or dropped:
 * `looseObject` round-trips mean a value from a future schema version can
 * reach this function, and showing it unchanged is better than showing
 * "Invalid Date" or nothing at all.
 */
export function formatArticleDate(value: string, lang: string): string {
  const match = ISO_DATE.exec(value);
  if (match === null) return value;
  const [, year, month, day] = match;
  if (year === undefined || month === undefined || day === undefined) return value;
  const family = languageFamily(lang);
  const monthIndex = Number.parseInt(month, 10) - 1;
  const monthLabel = MONTH_LABELS[family][monthIndex] ?? month;
  const dayLabel = String(Number.parseInt(day, 10));
  if (family === "en") return `${monthLabel} ${dayLabel}, ${year}`;
  return `${dayLabel} ${monthLabel} ${year}`;
}
