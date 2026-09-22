/**
 * Switching Themes without losing the author's design choices (ADR 0051).
 *
 * ADR 0046 requires that if a new Theme does not offer the variant an author
 * picked, the Block falls back to the new Theme's default *and* the previous
 * Theme's selection is remembered for switching back. Getting that right is
 * the difference between "try the other Theme for a second" being free and
 * being destructive.
 *
 * The split that makes it simple: `block.variant` is the live choice the
 * renderer reads, and `block.variantsByTheme` is a per-Theme archive the
 * editor maintains. On every switch we file the outgoing choice under the
 * outgoing Theme's id and retrieve the incoming Theme's, if any. The renderer
 * never has to ask "which of these is current?" — it reads one field.
 *
 * Nothing here touches Block `data`. Switching Themes is a presentation
 * change; content is untouched, which is what the issue-106 plan's "switching
 * Themes must not remove fields or change saved Block data" guarantees.
 */

import type { BlockEnvelope, Site } from "@sosb/schema";
import { offersBlockVariant, offersShellVariant, type ThemeBundle } from "@sosb/renderer";

/** File `variant` under the outgoing theme, then load the incoming theme's. */
function switchBlockVariant(
  block: BlockEnvelope,
  fromThemeId: string,
  toTheme: ThemeBundle | undefined,
): BlockEnvelope {
  const memory: Record<string, string> = { ...(block.variantsByTheme ?? {}) };

  if (typeof block.variant === "string" && block.variant.length > 0) {
    memory[fromThemeId] = block.variant;
  } else {
    // An explicit "use the default" is worth remembering too — otherwise
    // switching away and back would resurrect a choice the author cleared.
    delete memory[fromThemeId];
  }

  const remembered = toTheme === undefined ? undefined : memory[toTheme.id];
  const nextVariant =
    remembered !== undefined &&
    toTheme !== undefined &&
    offersBlockVariant(toTheme, block.type, remembered)
      ? remembered
      : undefined;

  const next: BlockEnvelope = { ...block, variantsByTheme: memory };
  if (nextVariant === undefined) {
    delete (next as { variant?: string }).variant;
  } else {
    next.variant = nextVariant;
  }
  if (Object.keys(memory).length === 0) {
    delete (next as { variantsByTheme?: Record<string, string> }).variantsByTheme;
  }
  return next;
}

/**
 * Apply a Theme switch to a Site: set the new id and version, and migrate
 * every Block's and the shell's variant selection through the per-Theme
 * memory.
 *
 * `toTheme` is `undefined` when switching to a Theme whose package is not
 * installed — the choices are still filed away, so importing the package later
 * restores them.
 */
export function applyThemeSwitch(site: Site, toThemeId: string, toTheme?: ThemeBundle): Site {
  const fromThemeId = site.theme.id;
  if (fromThemeId === toThemeId) return site;

  const shellMemory: Record<string, string> = { ...(site.theme.shellVariantsByTheme ?? {}) };
  if (typeof site.theme.shellVariant === "string" && site.theme.shellVariant.length > 0) {
    shellMemory[fromThemeId] = site.theme.shellVariant;
  } else {
    delete shellMemory[fromThemeId];
  }
  const rememberedShell = shellMemory[toThemeId];
  const nextShell =
    rememberedShell !== undefined &&
    toTheme !== undefined &&
    offersShellVariant(toTheme, rememberedShell)
      ? rememberedShell
      : undefined;

  const theme: Site["theme"] = { ...site.theme, id: toThemeId };
  if (toTheme !== undefined && toTheme.origin === "package") {
    theme.version = toTheme.version;
  } else {
    delete (theme as { version?: string }).version;
  }
  if (nextShell === undefined) {
    delete (theme as { shellVariant?: string }).shellVariant;
  } else {
    theme.shellVariant = nextShell;
  }
  if (Object.keys(shellMemory).length === 0) {
    delete (theme as { shellVariantsByTheme?: Record<string, string> }).shellVariantsByTheme;
  } else {
    theme.shellVariantsByTheme = shellMemory;
  }

  // Articles hold Blocks outside `site.pages`, and those Blocks render through
  // exactly the same variant machinery (`ArticleShell` passes the resolved
  // Theme into the block-render context). Missing them here would leave an
  // Article's Blocks carrying a choice made under the *outgoing* Theme: the
  // renderer's `offersBlockVariant` gate hides most of the damage, but a
  // variant id both Themes happen to use would silently apply a design the
  // author never picked for the new Theme — and switching back would not
  // restore the old one, because nothing was ever filed away.
  const withArticles =
    site.articles === undefined
      ? {}
      : {
          articles: site.articles.map((article) => ({
            ...article,
            blocks: article.blocks.map((block) => switchBlockVariant(block, fromThemeId, toTheme)),
          })),
        };

  return {
    ...site,
    theme,
    pages: site.pages.map((page) => ({
      ...page,
      blocks: page.blocks.map((block) => switchBlockVariant(block, fromThemeId, toTheme)),
    })),
    ...withArticles,
  };
}

/**
 * Set (or clear) the live variant of one Block, by id.
 *
 * Searches Articles as well as Pages. Block ids are unique across the whole
 * Site, so "by id" means by id — scoping the search to `site.pages` made the
 * Variant control a no-op for any Block inside an Article.
 */
export function setBlockVariant(site: Site, blockId: string, variant: string | undefined): Site {
  const apply = (block: BlockEnvelope): BlockEnvelope => {
    if (block.id !== blockId) return block;
    const next: BlockEnvelope = { ...block };
    if (variant === undefined) {
      delete (next as { variant?: string }).variant;
    } else {
      next.variant = variant;
    }
    return next;
  };

  return {
    ...site,
    pages: site.pages.map((page) => ({ ...page, blocks: page.blocks.map(apply) })),
    ...(site.articles === undefined
      ? {}
      : {
          articles: site.articles.map((article) => ({
            ...article,
            blocks: article.blocks.map(apply),
          })),
        }),
  };
}

/** Set (or clear) the page-shell variant. */
export function setShellVariant(site: Site, variant: string | undefined): Site {
  const theme: Site["theme"] = { ...site.theme };
  if (variant === undefined) {
    delete (theme as { shellVariant?: string }).shellVariant;
  } else {
    theme.shellVariant = variant;
  }
  return { ...site, theme };
}

/**
 * Is this Theme safe to remove?
 *
 * ADR 0051 blocks removing a Theme the Site is currently using, rather than
 * removing it and silently restyling the Site. The editor explains the block
 * and points at the fix (switch Theme first).
 */
export function themeRemovalBlockedReason(site: Site, themeId: string): string | undefined {
  if (site.theme.id !== themeId) return undefined;
  return (
    "This Site is using this Theme right now. Switch to another Theme first, " +
    "then remove it. Your content is not affected either way."
  );
}
