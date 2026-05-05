/**
 * Browser-language detection.
 *
 * The PRD pins the rule: "ro-* browser language → RO; everything else → EN."
 * We generalise that to: walk `navigator.languages` in priority order,
 * normalise to the BCP-47 primary subtag, return the first match against
 * `supported`. Fall back to `defaultLocale` if nothing matches.
 *
 * The function takes its inputs explicitly so it remains pure and node-
 * unit-testable. The browser shell calls
 * `detectLocale({ supported: SUPPORTED_LOCALES, defaultLocale: DEFAULT_LOCALE,
 *  navigatorLanguages: typeof navigator === "undefined" ? undefined :
 *  navigator.languages })`.
 */
import type { Locale } from "./types.js";

export interface DetectLocaleOptions<L extends string = Locale> {
  readonly supported: readonly L[];
  readonly defaultLocale: L;
  readonly navigatorLanguages: readonly string[] | undefined;
}

export function detectLocale<L extends string = Locale>(options: DetectLocaleOptions<L>): L {
  const { supported, defaultLocale, navigatorLanguages } = options;
  if (navigatorLanguages === undefined || navigatorLanguages.length === 0) {
    return defaultLocale;
  }
  const supportedSet = new Set<string>(supported);
  for (const raw of navigatorLanguages) {
    const primary = raw.toLowerCase().split("-")[0];
    if (primary !== undefined && supportedSet.has(primary)) {
      return primary as L;
    }
  }
  return defaultLocale;
}
