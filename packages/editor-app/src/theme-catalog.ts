/**
 * Backwards-compat re-export. The canonical theme catalog lives in
 * `@sosb/themes` since T17 (ADR 0043 follow-up). New code should import
 * directly from `@sosb/themes`; this shim keeps existing editor-app
 * imports (theme-picker, font-picker) working without a churn-only
 * rewrite.
 */
export { buildThemeCatalog } from "@sosb/themes";
export type {
  ThemeCatalog,
  ThemeCatalogEntry,
  ThemeFonts,
} from "@sosb/themes";
