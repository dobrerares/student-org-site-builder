# @sosb/i18n

Keyed message lookup with RO/EN, browser language detection, and override
persistence.

Tracking issue: [#42](https://github.com/dobrerares/student-org-site-builder/issues/42).
Design: [`docs/adr/0028-i18n-framework.md`](../../docs/adr/0028-i18n-framework.md).

## Public surface

```ts
import {
  createTranslator,
  detectLocale,
  loadStoredLocale,
  saveLocale,
  enCatalog,
  roCatalog,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  LOCALE_PREFERENCE_PATH,
  type Locale,
  type Translator,
  type EditorMessageKey,
} from "@sosb/i18n";

const t = createTranslator({
  catalogs: { en: enCatalog, ro: roCatalog },
  defaultLocale: DEFAULT_LOCALE,
  locale: detectLocale({
    supported: SUPPORTED_LOCALES,
    defaultLocale: DEFAULT_LOCALE,
    navigatorLanguages: typeof navigator === "undefined" ? undefined : navigator.languages,
  }),
});

t("topbar.import"); // "Import" (en) / "Importă" (ro)
t("greeting.hello", { name: "Maria" }); // "Hello, Maria!"
t.locale; // "en"
t.setLocale("ro"); // switches; subscribers fire
```

## Adding a translation

See [CONTRIBUTING.md](../../CONTRIBUTING.md#translations) for the contributor-
facing version of this checklist. In short:

1. Add the new key to `src/locales/keys.ts` (the `EditorMessageKey` union).
2. Add the message to `src/locales/en.ts` AND `src/locales/ro.ts`.
3. The catalog-parity test fails CI if either locale falls behind.

## Romanian translations

The strings in `src/locales/ro.ts` are AI-drafted. A native Romanian
speaker should review them before public release. Several strings have
multiple acceptable forms (e.g. "Resetează" vs "Reinițializează") flagged
in the file's header comment.
