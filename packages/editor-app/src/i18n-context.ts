/**
 * Preact context for the editor's translator.
 *
 * The translator itself lives in `@sosb/i18n` and is framework-agnostic. The
 * editor app exposes it through a Preact context so deeply nested form
 * controls (block forms in #9-#22 etc.) can `useTranslator()` without
 * threading the prop through every layer.
 *
 * The component layer also owns the locale-change re-render: subscribing to
 * `translator.subscribe(...)` flips a render-trigger state, since the
 * translator's identity is stable across locale changes.
 */
import { createContext } from "preact";
import { useCallback, useContext, useEffect, useState } from "preact/hooks";
import {
  createTranslator,
  enCatalog,
  roCatalog,
  DEFAULT_LOCALE,
  type Translator,
} from "@sosb/i18n";

/**
 * The default translator used when a consumer does not provide one — chiefly
 * test scaffolding and the existing pre-#42 callers in this package's tests.
 *
 * Defaulting to `DEFAULT_LOCALE` (English) matches the PRD detection rule:
 * "ro-* browser language → RO; everything else → EN."
 */
function buildDefaultTranslator(): Translator {
  return createTranslator({
    catalogs: { en: enCatalog, ro: roCatalog },
    defaultLocale: DEFAULT_LOCALE,
    locale: DEFAULT_LOCALE,
  });
}

const I18nContext = createContext<Translator>(buildDefaultTranslator());

export const I18nProvider = I18nContext.Provider;

/**
 * Read the current translator and re-render on locale change.
 *
 * Returns a stable callable; the hook flips an internal counter when the
 * translator's `subscribe` listener fires, so any component using `t(...)`
 * inside its render naturally picks up the new locale.
 */
export function useTranslator(): Translator {
  const t = useContext(I18nContext);
  const [, setTick] = useState(0);
  const bump = useCallback(() => {
    setTick((n) => n + 1);
  }, []);
  useEffect(() => t.subscribe(bump), [t, bump]);
  return t;
}
