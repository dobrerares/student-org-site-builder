/**
 * Does this Site's `theme.id` actually point at a theme we have?
 *
 * A Site archive names its theme; an imported Theme package travels inside the
 * archive under `themes/<id>/` (issue-106 plan). Those two can come apart — a
 * hand-edited `data.json`, a damaged archive, a package the author removed.
 *
 * ADR 0051 decides what happens then: the Site still opens and still saves
 * with all of its content intact, the editor names the missing theme and
 * offers a repair (switch to a built-in), and `build()` refuses to export
 * until it is resolved. What we deliberately do *not* do is quietly render
 * under some other theme — that produces a plausible-looking wrong site, and
 * an author who exports it never learns their design is missing.
 */

import type { Site } from "@sosb/schema";
import type { BlockEnvelope } from "@sosb/schema";
import type { ThemeBundle } from "./theme-bundle.js";
import { isBuiltinThemeId, offersBlockVariant } from "./theme-bundle.js";

export interface ThemeReferenceIssue {
  readonly code: "theme-missing";
  /** The id the Site asks for. */
  readonly themeId: string;
  /** Operator-readable summary; the editor localises its own copy. */
  readonly message: string;
}

/**
 * Report a dangling `site.theme.id`, or `undefined` when the reference
 * resolves.
 *
 * @param installedThemeIds ids of the Theme packages available to this Site,
 *                          i.e. what was found under `themes/` in the archive.
 */
export function themeReferenceIssue(
  site: Site,
  installedThemeIds: readonly string[] = [],
): ThemeReferenceIssue | undefined {
  const themeId = site.theme.id;
  if (isBuiltinThemeId(themeId)) return undefined;
  if (installedThemeIds.includes(themeId)) return undefined;
  return {
    code: "theme-missing",
    themeId,
    message:
      `This Site uses the Theme package "${themeId}", which is not installed. ` +
      `Import the package to restore the design, or switch to a built-in Theme. ` +
      `Your content is unchanged either way.`,
  };
}

/**
 * The design variant that actually applies to a Block under a given theme.
 *
 * The saved choice only applies when the active theme offers it for that Block
 * type. Switching themes therefore *suspends* a variant rather than erasing it
 * — ADR 0046 requires the previous theme's selection to come back when the
 * author switches back, and the editor's per-theme memory (ADR 0051) restores
 * it into `block.variant` on the way.
 */
export function activeBlockVariant(block: BlockEnvelope, bundle: ThemeBundle): string | undefined {
  const saved = (block as { variant?: unknown }).variant;
  if (typeof saved !== "string" || saved.length === 0) return undefined;
  return offersBlockVariant(bundle, block.type, saved) ? saved : undefined;
}
