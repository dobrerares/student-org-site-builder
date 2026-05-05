import type { Page, Site } from "@sosb/schema";

/**
 * Multi-page + multi-language URL/slug strategy.
 *
 * Per the PRD (§ 195) and ADRs 0006 + 0007, slugs are flat — no nested
 * hierarchy in v1. The page at `navOrder: 0` in the site's `defaultLanguage`
 * is the home page; it is mapped to `/` rather than `/<slug>/`. Every other
 * default-language page is mapped to `/<slug>/`. Pages in any *other*
 * declared language are prefixed with `/<lang>/`: the per-language home goes
 * to `/<lang>/`, every other secondary-language page goes to
 * `/<lang>/<slug>/`. This satisfies AC #5 (per-language URL trees).
 *
 * Within each language, slugs are unique (the schema validator enforces
 * this). Two pages from different languages may share a slug — the
 * `/<lang>/...` prefix on secondary languages structurally resolves the
 * collision so a default-language `/despre/` and an English `/en/about/`
 * never compete for the same dist path.
 *
 * The renderer and the build pipeline both consume these helpers so the
 * "nav links here" and "emit file at this path" decisions stay in sync.
 */

/**
 * Native human-readable name for each declared language code, used in the
 * language-switcher UI ("Română", "English", never flags — see PRD § 109).
 *
 * Falls back to the language code itself when no native name is registered;
 * the editor / wizard is responsible for ASCII-folded language codes
 * (`ro`, `en`, `de`, `es`, `fr`, `it`, ...).
 */
const NATIVE_LANGUAGE_NAMES: Record<string, string> = {
  ro: "Română",
  en: "English",
  de: "Deutsch",
  es: "Español",
  fr: "Français",
  it: "Italiano",
  hu: "Magyar",
  pl: "Polski",
  pt: "Português",
  ru: "Русский",
  uk: "Українська",
};

/**
 * Resolve the human-readable native name for a language code, falling back
 * to the code itself for languages we don't have an entry for. Surfaced as a
 * helper so themes can also call it for theme-level UI.
 */
export function nativeLanguageName(lang: string): string {
  return NATIVE_LANGUAGE_NAMES[lang] ?? lang;
}

/**
 * Pick the default-language home page index — the first page in the site's
 * `defaultLanguage` with `navOrder: 0`. Falls back to `0` when no candidate
 * exists. This is the page that lands at `/` and `dist/index.html`.
 */
export function homePageIndex(site: Site): number {
  return languageHomeIndex(site, site.defaultLanguage);
}

/**
 * Pick the home page index *for a specific language*. Used to:
 *   - emit `/<lang>/` for non-default languages,
 *   - drive the missing-translation fallback (visitors land on the chosen
 *     language's home page rather than a 404).
 *
 * Falls back to the first page declared in that language; if no page exists
 * in the language at all, returns `-1` so callers can branch.
 */
export function languageHomeIndex(site: Site, lang: string): number {
  const navZero = site.pages.findIndex(
    (p) => p.lang === lang && p.navOrder === 0,
  );
  if (navZero !== -1) return navZero;
  const anyPage = site.pages.findIndex((p) => p.lang === lang);
  return anyPage;
}

function isLanguageHome(site: Site, page: Page): boolean {
  const idx = languageHomeIndex(site, page.lang);
  if (idx === -1) return false;
  const home = site.pages[idx];
  if (home === undefined) return false;
  return home.slug === page.slug && home.lang === page.lang;
}

/**
 * Map a `Page` to its URL path (always starts with `/`, always ends with `/`).
 *
 *   - default-language home → `/`
 *   - default-language non-home → `/<slug>/`
 *   - secondary-language home → `/<lang>/`
 *   - secondary-language non-home → `/<lang>/<slug>/`
 *
 * Trailing slash on every URL keeps `<a href>` resolution unambiguous and
 * matches the directory-style file emit one-to-one with the URL.
 */
export function pagePath(site: Site, page: Page): string {
  if (page.lang === site.defaultLanguage) {
    if (isLanguageHome(site, page)) return "/";
    return `/${page.slug}/`;
  }
  if (isLanguageHome(site, page)) return `/${page.lang}/`;
  return `/${page.lang}/${page.slug}/`;
}

/**
 * The dist-folder relative path where a page is emitted. Mirrors `pagePath`
 * with an `index.html` suffix and no leading `/`.
 *
 *   - default-language home → `index.html`
 *   - default-language non-home → `<slug>/index.html`
 *   - secondary-language home → `<lang>/index.html`
 *   - secondary-language non-home → `<lang>/<slug>/index.html`
 */
export function pageDistPath(site: Site, page: Page): string {
  if (page.lang === site.defaultLanguage) {
    if (isLanguageHome(site, page)) return "index.html";
    return `${page.slug}/index.html`;
  }
  if (isLanguageHome(site, page)) return `${page.lang}/index.html`;
  return `${page.lang}/${page.slug}/index.html`;
}

/**
 * URL path for the home page of `lang`. Default language → `/`. Secondary
 * language → `/<lang>/`. When the language has no pages at all, returns the
 * default-language home (`/`) as the safest graceful fallback.
 */
export function homePagePathForLanguage(site: Site, lang: string): string {
  if (languageHomeIndex(site, lang) === -1) return "/";
  if (lang === site.defaultLanguage) return "/";
  return `/${lang}/`;
}

/**
 * Pages that belong in the navigation for the given page's language.
 *
 * Filtering rules (per PRD § 64-67 and AC):
 *   - Same `lang` as the active page (cross-language nav is the language
 *     switcher's job).
 *   - `showInNav: true` (utility pages opt out of the menu — PRD § 65).
 *   - Sorted by `navOrder` ascending; ties broken by `pages[]` order, so
 *     repeated builds stay deterministic.
 *
 * If the result has fewer than 2 pages, the renderer hides the nav entirely
 * (single-page UX preserved).
 */
export function navPagesFor(site: Site, activePage: Page): Page[] {
  return site.pages
    .map((page, idx) => ({ page, idx }))
    .filter(({ page }) => page.lang === activePage.lang && page.showInNav === true)
    .sort((a, b) => {
      if (a.page.navOrder !== b.page.navOrder) {
        return a.page.navOrder - b.page.navOrder;
      }
      return a.idx - b.idx;
    })
    .map(({ page }) => page);
}

/**
 * One entry of the language-switcher data structure.
 */
export interface LanguageSwitcherEntry {
  /** Language code (`"ro"`, `"en"`, ...). */
  readonly lang: string;
  /** Native display name (`"Română"`, `"English"`, ...). */
  readonly nativeName: string;
  /** Resolved href: `localizedAs` counterpart or language home fallback. */
  readonly href: string;
  /** True when this language is the active page's language. */
  readonly isActive: boolean;
}

/**
 * The language switcher's row data, in declared `site.languages` order.
 *
 * For each declared language:
 *   - if it equals the active page's language, the href is the active page
 *     itself (a self-link, so themes can render the active language as a
 *     non-link or styled differently — but the spec wants it clickable, so
 *     we emit a real `<a>`),
 *   - otherwise look up `localizedAs[lang]`; if it points at a real
 *     counterpart page, link to that page,
 *   - otherwise fall back to the language home page (`/`, `/<lang>/`, ...).
 *     This is the "graceful fallback" required by AC: visitors never land on
 *     a 404 just because some pages are untranslated.
 *
 * Returns `[]` for single-language sites — the renderer uses that to skip
 * emitting the switcher entirely.
 */
export function languageSwitcherEntriesFor(
  site: Site,
  activePage: Page,
): LanguageSwitcherEntry[] {
  if (site.languages.length < 2) return [];
  const localized = activePage.localizedAs ?? {};
  return site.languages.map((lang) => {
    if (lang === activePage.lang) {
      return {
        lang,
        nativeName: nativeLanguageName(lang),
        href: pagePath(site, activePage),
        isActive: true,
      };
    }
    const counterpartSlug = localized[lang];
    if (counterpartSlug !== undefined) {
      const counterpart = site.pages.find(
        (p) => p.lang === lang && p.slug === counterpartSlug,
      );
      if (counterpart !== undefined) {
        return {
          lang,
          nativeName: nativeLanguageName(lang),
          href: pagePath(site, counterpart),
          isActive: false,
        };
      }
    }
    return {
      lang,
      nativeName: nativeLanguageName(lang),
      href: homePagePathForLanguage(site, lang),
      isActive: false,
    };
  });
}

/**
 * One entry of the hreflang annotations emitted in the page <head>.
 */
export interface HreflangEntry {
  /** Hreflang code (`"ro"`, `"en"`, `"x-default"`). */
  readonly hreflang: string;
  /** Resolved href (path-relative or absolute, depending on caller). */
  readonly href: string;
}

/**
 * Hreflang annotations for the active page, in a fixed deterministic order:
 *
 *   1. one entry per declared language in `site.languages` order,
 *   2. one final `x-default` entry pointing at the *default-language*
 *      counterpart (or the default-language home if no counterpart).
 *
 * Per language, the href is:
 *   - the active page itself if `lang === activePage.lang`,
 *   - the `localizedAs` counterpart if one exists,
 *   - the language home page as a graceful fallback otherwise.
 *
 * Returns `[]` for single-language sites — the renderer uses that to skip
 * emitting hreflang entirely (single-language sites should not advertise
 * alternates per Google's i18n SEO guidance).
 */
export function hreflangEntriesFor(site: Site, activePage: Page): HreflangEntry[] {
  if (site.languages.length < 2) return [];
  const localized = activePage.localizedAs ?? {};
  const entries: HreflangEntry[] = site.languages.map((lang) => {
    if (lang === activePage.lang) {
      return { hreflang: lang, href: pagePath(site, activePage) };
    }
    const counterpartSlug = localized[lang];
    if (counterpartSlug !== undefined) {
      const counterpart = site.pages.find(
        (p) => p.lang === lang && p.slug === counterpartSlug,
      );
      if (counterpart !== undefined) {
        return { hreflang: lang, href: pagePath(site, counterpart) };
      }
    }
    return { hreflang: lang, href: homePagePathForLanguage(site, lang) };
  });
  // x-default points at the default-language counterpart of the active page,
  // or the default-language home if there is no counterpart in that language.
  const defaultLang = site.defaultLanguage;
  let xDefaultHref: string;
  if (activePage.lang === defaultLang) {
    xDefaultHref = pagePath(site, activePage);
  } else {
    const counterpartSlug = localized[defaultLang];
    const counterpart =
      counterpartSlug !== undefined
        ? site.pages.find((p) => p.lang === defaultLang && p.slug === counterpartSlug)
        : undefined;
    xDefaultHref =
      counterpart !== undefined
        ? pagePath(site, counterpart)
        : homePagePathForLanguage(site, defaultLang);
  }
  entries.push({ hreflang: "x-default", href: xDefaultHref });
  return entries;
}
