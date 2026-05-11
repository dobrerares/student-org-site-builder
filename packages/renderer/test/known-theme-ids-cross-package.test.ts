/**
 * Cross-package drift guard for the canonical theme-id list.
 *
 * Two packages independently maintain the list of canonical theme IDs:
 *   - `@sosb/renderer` exports `KNOWN_THEME_IDS` for the dynamic theme
 *     matrix (ADR 0026) and the a11y CI gate.
 *   - `@sosb/schema` exports `KNOWN_THEME_IDS_FOR_VALIDATION` for the
 *     warning-tier validation rule (ADR 0044 Corollary 3) that fires on
 *     unknown `site.theme.id` values.
 *
 * The duplication is structural — schema cannot import from renderer
 * (would invert the dependency graph) — and is acknowledged in both
 * sources for future cleanup (plan T17). Until that cleanup lands, this
 * test is the load-bearing guard: if a new theme is added to one list
 * but not the other, CI fails.
 */
import { describe, expect, test } from "vitest";

import { KNOWN_THEME_IDS } from "../src/index.js";
import { KNOWN_THEME_IDS_FOR_VALIDATION } from "@sosb/schema";

describe("KNOWN_THEME_IDS cross-package drift guard", () => {
  test("renderer and schema agree on the canonical theme id set", () => {
    const rendererSet = [...KNOWN_THEME_IDS].sort();
    const schemaSet = [...KNOWN_THEME_IDS_FOR_VALIDATION].sort();
    expect(rendererSet).toEqual(schemaSet);
  });
});
