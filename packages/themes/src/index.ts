/**
 * `@sosb/themes` — Preact theme component sets, token defaults, and curated
 * demo templates.
 *
 * v1 ships:
 *  - The curated demo template "Asociația Studențească Demo" (#34) under
 *    `templates/`. The five Preact theme component sets land in #28-#31
 *    and #47.
 *  - The user-facing theme catalog (`buildThemeCatalog()`) — labels,
 *    descriptions, and per-theme curated font lists for the picker UIs
 *    in `@sosb/editor-app` and `@sosb/wizard`. T17 follow-up to ADR 0043.
 */
export {
  ASOCIATIA_STUDENTEASCA_DEMO,
  ASOCIATIA_STUDENTEASCA_DEMO_ID,
  asociatiaStudenteascaDemoData,
  asociatiaStudenteascaDemoMetadata,
  TEMPLATES,
} from "./templates/index.js";
export type {
  AssetCredits,
  AsociatiaStudenteascaDemoMetadata,
  ReplaceMarker,
  TemplateDescriptor,
} from "./templates/index.js";
export { buildThemeCatalog } from "./theme-catalog.js";
export type {
  ThemeCatalog,
  ThemeCatalogEntry,
  ThemeFonts,
} from "./theme-catalog.js";
