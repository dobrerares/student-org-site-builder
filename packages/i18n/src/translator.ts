/**
 * Translator factory. Holds a per-locale catalog map, an active locale, a
 * default-locale fallback, and a small subscriber list. Framework-agnostic:
 * `@sosb/i18n` does NOT depend on Preact. The Preact binding lives in the
 * editor app where the rest of the UI does.
 *
 * The translator is a CALLABLE object: `t("topbar.import")` performs the
 * lookup, while `t.locale`, `t.setLocale`, and `t.subscribe` expose the
 * imperative surface. We attach the methods to a function instance because
 * the JSX-side ergonomics of `<button>{t("topbar.import")}</button>` are
 * worth the small ceremony at construction time.
 */
import { formatMessage } from "./format.js";
import type { Locale, MessageCatalog, Translator } from "./types.js";

export interface CreateTranslatorOptions {
  readonly catalogs: Readonly<Partial<Record<Locale, MessageCatalog>>>;
  /** Locale used for fallback when a key is missing from the active locale. */
  readonly defaultLocale: Locale;
  /** Initial active locale. */
  readonly locale: Locale;
}

/**
 * Build a translator. Throws if `locale` (or `defaultLocale`) is not
 * registered in `catalogs` — fail loudly at boot rather than producing a
 * translator that yields the literal key for every lookup.
 */
export function createTranslator(options: CreateTranslatorOptions): Translator {
  if (options.catalogs[options.locale] === undefined) {
    throw new Error(`@sosb/i18n: unknown locale '${options.locale}' — no catalog registered`);
  }
  if (options.catalogs[options.defaultLocale] === undefined) {
    throw new Error(
      `@sosb/i18n: unknown defaultLocale '${options.defaultLocale}' — no catalog registered`,
    );
  }

  let activeLocale: Locale = options.locale;
  const listeners = new Set<(locale: Locale) => void>();
  const warnedMissing = new Set<string>();

  function lookup(key: string): string | undefined {
    const active = options.catalogs[activeLocale];
    const fromActive = active?.[key];
    if (fromActive !== undefined) return fromActive;
    const fallback = options.catalogs[options.defaultLocale];
    return fallback?.[key];
  }

  function translate(key: string, params?: Readonly<Record<string, string | number>>): string {
    const template = lookup(key);
    if (template === undefined) {
      if (!warnedMissing.has(key)) {
        warnedMissing.add(key);
        console.warn(
          `@sosb/i18n: missing key '${key}' in locale '${activeLocale}' (and default '${options.defaultLocale}')`,
        );
      }
      return key;
    }
    return formatMessage(template, params, activeLocale);
  }

  // Attach the object-shaped surface to the function. The cast is the
  // smallest readable expression of "this function is also a Translator".
  const translator = translate as Translator & {
    -readonly [K in keyof Translator]: Translator[K];
  };

  Object.defineProperty(translator, "locale", {
    enumerable: true,
    configurable: false,
    get(): Locale {
      return activeLocale;
    },
  });

  translator.setLocale = function setLocale(locale: Locale): void {
    if (options.catalogs[locale] === undefined) {
      throw new Error(`@sosb/i18n: unknown locale '${locale}' — no catalog registered`);
    }
    if (locale === activeLocale) return;
    activeLocale = locale;
    for (const listener of listeners) listener(locale);
  };

  translator.subscribe = function subscribe(listener: (locale: Locale) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return translator;
}

/**
 * Diff two catalogs.
 *
 * Returns the keys present in `base` but absent in `target`. Used in dev
 * builds and tests to flag translation gaps without crashing the app.
 *
 * The "missing-key detector" the PRD mentions is exactly this — wired into a
 * vitest catalog-parity assertion (build-time gate) plus exposed at runtime
 * for an in-editor "translation health" panel later if we want one.
 */
export function findMissingKeys(base: MessageCatalog, target: MessageCatalog): string[] {
  const missing: string[] = [];
  for (const key of Object.keys(base)) {
    if (target[key] === undefined) missing.push(key);
  }
  return missing.sort();
}
