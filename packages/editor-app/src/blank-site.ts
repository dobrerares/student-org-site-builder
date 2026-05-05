/**
 * Blank-site factory.
 *
 * The welcome screen's "Start blank" path needs a fresh, valid `Site`
 * object with a single page containing a single hero block — per the
 * AC for issue #32 and per the PRD's "Default 1 page on new sites"
 * decision.
 *
 * The factory is pure (no IO, no randomness). Each call returns a
 * fresh draft (deep clone of an internal template) so callers can
 * mutate freely without aliasing. The output validates clean against
 * `@sosb/schema`'s `validate()`.
 *
 * Tracking issue: #32.
 */

import type { Site } from "@sosb/schema";
import { HERO_BLOCK_VERSION, SITE_SCHEMA_VERSION } from "@sosb/schema";

/**
 * Produce a fresh blank site. The shape mirrors
 * `packages/editor-app/test/fixtures/minimal-site.json` so the editor
 * can mount it without any further bootstrapping.
 */
export function createBlankSite(): Site {
  // Build the object inline rather than deep-cloning a module-level
  // template — this keeps `Site`-typed access to fields and lets future
  // additions to `Site` cause a TS error here rather than a silent
  // schema mismatch at runtime.
  return {
    schemaVersion: SITE_SCHEMA_VERSION,
    org: {
      name: "My Organization",
    },
    theme: {
      id: "minimal",
    },
    defaultLanguage: "ro",
    languages: ["ro"],
    pages: [
      {
        slug: "acasa",
        lang: "ro",
        navLabel: "Acasă",
        navOrder: 0,
        showInNav: true,
        blocks: [
          {
            id: "blk_blank_hero",
            type: "hero",
            version: HERO_BLOCK_VERSION,
            data: {
              title: "Welcome",
            },
          },
        ],
      },
    ],
  };
}
