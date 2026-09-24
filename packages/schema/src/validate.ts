import { z } from "zod";
import { BlockEnvelopeSchema, KnownBlockSchemas, isKnownBlockType } from "./blocks/index.js";
import { ARTICLE_ROUTE_PREFIX, normalizeTagLabel } from "./article.js";
import type { Article } from "./article.js";
import {
  articlesById,
  articlesOf,
  inspectArticleSelection,
  resolveArticleSelection,
} from "./article-select.js";
import type { ArticleSelection } from "./blocks/article-list.js";
import { DEFAULT_ARTICLE_LIST_MODE } from "./blocks/article-list.js";
import { SiteSchema } from "./site.js";
import { checkSlug } from "./slug.js";
import {
  collectRichTextImages,
  collectRichTextLinkTargets,
  collectUnsupportedRichText,
  isEmptyRichTextDocument,
  type RichTextDocument,
  type RichTextLinkTarget,
} from "./rich-text-doc.js";
import { isCustomBlockType } from "./custom-blocks/declaration.js";
import { checkCustomBlockData } from "./custom-blocks/check-data.js";
import { customBlockAvailabilityFor, type CustomBlockRegistry } from "./custom-blocks/registry.js";

/**
 * Canonical theme IDs the renderer ships. Per ADR 0044 Corollary 3 the
 * site-level `theme.id` schema field stays loose (`z.string().min(1)`) so
 * future or third-party themes round-trip through this package without
 * losing data; closed-set discipline is enforced here as a warning-tier
 * rule (`site.theme.id.unknown`).
 *
 * This list duplicates the `KNOWN_THEME_IDS` export in
 * `@sosb/renderer/src/index.tsx` because the schema package must not depend
 * on the renderer (the dependency direction is renderer → schema). The
 * duplication is intentional and tracked for consolidation in T17 of the
 * 2026-05-11 form-overrides plan (export `ALL_THEME_IDS` from the renderer
 * if it can do so cleanly, otherwise accept the duplication).
 *
 * The name carries the `_FOR_VALIDATION` suffix to signal "this is what
 * the validator considers known"; consumers building picker UX should pull
 * the theme catalog from `@sosb/editor-app` instead. The renderer-side
 * `KNOWN_THEME_IDS` and this list are kept in sync by a cross-package
 * drift-guard test in `packages/renderer/test/`.
 *
 * `stub` is a real registered theme and round-trips successfully; it is
 * hidden from the editor's UI catalog but must NOT trigger the warning.
 */
export const KNOWN_THEME_IDS_FOR_VALIDATION: readonly string[] = [
  "academic",
  "civic",
  "editorial",
  "minimal",
  "modern",
  "stub",
];

const MIN_TEXT_CONTRAST_RATIO = 4.5;
const IMAGE_WARNING_BUDGET_BYTES = 200 * 1024;

/**
 * The three severity tiers from the PRD:
 *
 * - `error`   — blocking-on-confirmation. The editor surfaces these
 *                prominently and asks for explicit confirmation before
 *                publishing, but never hard-blocks (manual override
 *                allowed).
 * - `warning` — quality nudge. The editor surfaces these inline but
 *                never blocks publish.
 * - `info`    — silent. Surfaced only on a Site Health panel.
 */
export type Severity = "error" | "warning" | "info";

/**
 * One issue produced by validation. `path` is the route into the input
 * (mirroring the structure of Zod's own `path: PropertyKey[]`); `code` is
 * a stable machine identifier; `message` is the human-readable English
 * string the editor surfaces today (i18n by `code` is owned by the
 * editor/i18n module, not this package).
 */
export interface ValidationIssue {
  severity: Severity;
  path: (string | number)[];
  code: string;
  message: string;
  /**
   * Marks an `error` that the pre-export confirmation must NOT let the author
   * override.
   *
   * ADR 0016's rule is "blocking-on-confirmation, never hard-block". ADR 0048
   * carves out a narrow exception for public output that would be silently
   * wrong rather than merely imperfect. The cases:
   *
   * - an active explicit Article-list selection pointing at a Draft or
   *   deleted Article (issue #97);
   * - rich-text content this editor cannot render (issue #100);
   * - a rich-text image whose bytes are gone (issue #100);
   * - a Custom Block whose package is missing, damaged or needs a newer
   *   builder, or whose data was saved by a newer package (ADR 0055) — the
   *   issue-106 plan's "export stops until the extension is restored";
   * - a Custom Block image or document whose bytes are gone (ADR 0055).
   *
   * Forcing any of them through would publish a page missing the author's
   * work. Saving the editable project archive stays available in every case —
   * the block is on generating public output, never on keeping your work.
   *
   * Problems confined to Draft content are never blocking.
   */
  blocking?: boolean;
}

export interface ValidationResult {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
  /** Convenience: `errors.length === 0`. */
  ok: boolean;
}

/** True when `result` contains an error that the export dialog cannot override. */
export function hasBlockingIssues(result: ValidationResult): boolean {
  return result.errors.some((issue) => issue.blocking === true);
}

/**
 * Host-supplied capabilities validation cannot derive from the Site data
 * alone. Both are optional: without them the corresponding checks are simply
 * not run, which keeps `validate(data)` a pure one-argument function for the
 * many call sites that only care about structure.
 */
export interface ValidateOptions {
  /**
   * Whether a canonical `assets/…` VFS path currently has bytes. The editor
   * backs this with its project VFS. Needed because an asset reference is
   * structurally complete even when the file behind it is gone — the case
   * ADR 0048 makes a non-overridable public-export blocker.
   */
  readonly assetPathExists?: (path: string) => boolean;
  /**
   * The Custom Block types this Site's installed packages provide (ADR 0055).
   * When supplied, every Block with a namespaced type is checked: an
   * available type's data is checked against its declaration (warnings only,
   * per the issue-106 plan), an unavailable one is a blocking error that
   * preserves the content and stops the export. Without it — `validate(site)`
   * from the zip importer or the build — Custom Blocks are treated like any
   * unknown type: envelope only.
   */
  readonly customBlocks?: CustomBlockRegistry;
}

/**
 * Everything a Block rule may need beyond the Block itself.
 *
 * `publicContent` is the Draft carve-out: issue #100 is explicit that
 * problems confined to Draft content must not affect public-export
 * eligibility, so the same rule produces a blocking error inside a Page and
 * a plain error inside a Draft Article.
 */
interface BlockRuleContext {
  readonly publicContent: boolean;
  readonly assetPathExists?: ((path: string) => boolean) | undefined;
  /** Resolves a rich-text link target, or `null` when it no longer exists. */
  readonly resolveLinkTarget?: ((target: RichTextLinkTarget) => LinkTargetState) | undefined;
  /** Installed Custom Block types, when the host knows them (ADR 0055). */
  readonly customBlocks?: CustomBlockRegistry | undefined;
}

/** What a stored link target currently points at. */
type LinkTargetState = "ok" | "missing" | "draft";

const PUBLIC_BLOCK_CONTEXT: BlockRuleContext = { publicContent: true };

function emptyResult(): ValidationResult {
  return { errors: [], warnings: [], info: [], ok: true };
}

function finalize(result: ValidationResult): ValidationResult {
  result.ok = result.errors.length === 0;
  return result;
}

function pathFromZod(path: PropertyKey[]): (string | number)[] {
  return path.map((segment) => (typeof segment === "number" ? segment : String(segment)));
}

interface ZodIssueLike {
  readonly path: PropertyKey[];
  readonly code: string;
  readonly message: string;
}
type ParseResultLike =
  | { readonly success: true }
  | { readonly success: false; readonly error: { readonly issues: readonly ZodIssueLike[] } };

function zodIssuesToErrors(parseResult: ParseResultLike, codePrefix: string): ValidationIssue[] {
  if (parseResult.success) return [];
  return parseResult.error.issues.map((issue) => ({
    severity: "error" as const,
    path: pathFromZod([...issue.path]),
    code: `${codePrefix}.${issue.code}`,
    message: issue.message,
  }));
}

/**
 * Validate a full site (or anything that claims to be one).
 *
 * Schema violations become `errors`. Quality nudges (missing image alt on a
 * hero, etc.) become `warnings`. The result shape stays stable even when
 * the input is so malformed it can't be parsed — `errors` is populated and
 * `warnings` / `info` stay empty.
 */
export function validate(data: unknown, options: ValidateOptions = {}): ValidationResult {
  const result = emptyResult();

  const siteParse = SiteSchema.safeParse(data);
  result.errors.push(...zodIssuesToErrors(siteParse, "site"));

  if (siteParse.success) {
    runSiteRules(siteParse.data, result, options);
  }

  return finalize(result);
}

/**
 * Validate a single block in isolation. Useful for editor flows that only
 * touched one block, and for unit-testing block schemas.
 */
export function validateBlock(data: unknown): ValidationResult {
  const result = emptyResult();

  const envelope = BlockEnvelopeSchema.safeParse(data);
  result.errors.push(...zodIssuesToErrors(envelope, "block"));

  if (!envelope.success) return finalize(result);

  const block = envelope.data;
  if (isKnownBlockType(block.type)) {
    // Indexed-access into `KnownBlockSchemas` returns a union of schema
    // types whose `safeParse` overloads conflict under
    // `exactOptionalPropertyTypes`. Cast to the most general schema shape
    // (any Zod schema) — the runtime behaviour is identical, and the
    // resulting parsed value is funnelled back through `runBlockRules`'s
    // own typed switch.
    const knownSchema = KnownBlockSchemas[block.type] as unknown as z.ZodType;
    const knownParse = knownSchema.safeParse(data);
    result.errors.push(...zodIssuesToErrors(knownParse, `block.${block.type}`));
    if (knownParse.success) {
      runBlockRules(
        knownParse.data as z.infer<(typeof KnownBlockSchemas)[keyof typeof KnownBlockSchemas]>,
        result,
      );
    }
  } else {
    // Unknown block type: envelope already passed, so the data round-trips.
    // No extra rules to run.
  }

  return finalize(result);
}

/** Union of every known block's parsed shape. */
type KnownBlockData = z.infer<(typeof KnownBlockSchemas)[keyof typeof KnownBlockSchemas]>;

// ---------------------------------------------------------------------------
// Rule passes (PRD-listed quality nudges layered on top of schema parse).
// ---------------------------------------------------------------------------

function runSiteRules(
  site: z.infer<typeof SiteSchema>,
  result: ValidationResult,
  options: ValidateOptions = {},
): void {
  // Errors: every page's `lang` must appear in the languages list.
  site.pages.forEach((page, idx) => {
    if (!site.languages.includes(page.lang)) {
      result.errors.push({
        severity: "error",
        path: ["pages", idx, "lang"],
        code: "site.page.lang.notInLanguagesList",
        message: `Page language "${page.lang}" is not in the site's language list.`,
      });
    }
  });

  // Errors: page slugs must be unique within a language.
  const seen = new Map<string, number>();
  site.pages.forEach((page, idx) => {
    const key = `${page.lang}:${page.slug}`;
    const previous = seen.get(key);
    if (previous !== undefined) {
      result.errors.push({
        severity: "error",
        path: ["pages", idx, "slug"],
        code: "site.page.slug.duplicate",
        message: `Page link "${page.slug}" is used twice in language "${page.lang}".`,
      });
    } else {
      seen.set(key, idx);
    }
  });

  // Errors: page slugs must obey the flat-slug format. The structural
  // schema only checks `min(1)`; here we layer the URL-safety pattern.
  site.pages.forEach((page, idx) => {
    const failure = checkSlug(page.slug);
    if (failure !== null) {
      result.errors.push({
        severity: "error",
        path: ["pages", idx, "slug"],
        code: `site.page.${failure.code}`,
        message: failure.message,
      });
    }
  });

  // Errors: `articles` is the route prefix reserved for Articles (ADR 0047).
  // A Page claiming it would collide with every `/articles/<slug>/` URL, so
  // this is rejected outright rather than resolved by precedence.
  site.pages.forEach((page, idx) => {
    if (page.slug === ARTICLE_ROUTE_PREFIX) {
      result.errors.push({
        severity: "error",
        path: ["pages", idx, "slug"],
        code: "site.page.slug.reservedPrefix",
        message: `Page link "${ARTICLE_ROUTE_PREFIX}" is reserved for articles. Choose a different link, such as news or blog.`,
      });
    }
  });

  // Errors / warnings: localizedAs cross-references (#24).
  //
  //   - referenced language must be declared in site.languages (error)
  //   - referenced slug must exist in pages[] for that language (error)
  //   - a page must not list its own language in localizedAs (error)
  //   - on a multi-language site, a page lacking a counterpart in some other
  //     declared language is a quality warning, not an error.
  const langSlugs = new Map<string, Set<string>>();
  site.pages.forEach((page) => {
    const set = langSlugs.get(page.lang) ?? new Set<string>();
    set.add(page.slug);
    langSlugs.set(page.lang, set);
  });
  site.pages.forEach((page, idx) => {
    const localized = page.localizedAs;
    if (localized !== undefined) {
      for (const [otherLang, counterpartSlug] of Object.entries(localized)) {
        if (otherLang === page.lang) {
          result.errors.push({
            severity: "error",
            path: ["pages", idx, "localizedAs", otherLang],
            code: "site.page.localizedAs.selfReference",
            message: `Page "${page.slug}" is linked to itself for language "${otherLang}".`,
          });
          continue;
        }
        if (!site.languages.includes(otherLang)) {
          result.errors.push({
            severity: "error",
            path: ["pages", idx, "localizedAs", otherLang],
            code: "site.page.localizedAs.unknownLanguage",
            message: `Page "${page.slug}" links to language "${otherLang}", but that language is not enabled.`,
          });
          continue;
        }
        const slugsForLang = langSlugs.get(otherLang) ?? new Set<string>();
        if (!slugsForLang.has(counterpartSlug)) {
          result.errors.push({
            severity: "error",
            path: ["pages", idx, "localizedAs", otherLang],
            code: "site.page.localizedAs.unknownCounterpart",
            message: `Page "${page.slug}" links to "${counterpartSlug}" in language "${otherLang}", but that page does not exist.`,
          });
        }
      }
    }
    // Quality nudge: bilingual sites should have counterparts everywhere.
    if (site.languages.length >= 2) {
      const localizedKeys = new Set(Object.keys(localized ?? {}));
      const missing = site.languages.filter((lng) => lng !== page.lang && !localizedKeys.has(lng));
      if (missing.length > 0) {
        result.warnings.push({
          severity: "warning",
          path: ["pages", idx, "localizedAs"],
          code: "site.page.localizedAs.missingCounterpart",
          message: `Page "${page.slug}" is missing version(s) for: ${missing.join(", ")}.`,
        });
      }
    }
  });

  // Errors + warnings: each known block on each page is parsed against
  // its specific schema (deeper than the envelope) and rule-checked.
  // Deep-schema parse failures become `error` issues with paths rebased
  // onto the site, so callers see schema violations regardless of where
  // they nest. Quality nudges (warnings) come from `runBlockRules`.
  // Pages are always public content: there is no Draft Page state. The
  // context is built once and reused so the link resolver's index is not
  // rebuilt per Block.
  const blockContext: BlockRuleContext = {
    publicContent: true,
    assetPathExists: options.assetPathExists,
    resolveLinkTarget: makeLinkTargetResolver(site),
    customBlocks: options.customBlocks,
  };

  site.pages.forEach((page, pageIdx) => {
    runBlocksDeep(page.blocks, ["pages", pageIdx, "blocks"], result, blockContext);
  });

  // Warning: org logo without sibling logoAlt (accessibility nudge, mirrors hero).
  if (site.org.logo && !site.org.logoAlt) {
    result.warnings.push({
      severity: "warning",
      path: ["org", "logoAlt"],
      code: "site.org.logoAlt.missing",
      message:
        "The organisation logo needs a short image description for people using screen readers.",
    });
  }

  // Warnings: missing org email is a quality nudge per the PRD.
  if (!site.org.email || site.org.email.trim().length === 0) {
    result.warnings.push({
      severity: "warning",
      path: ["org", "email"],
      code: "site.org.email.missing",
      message: "Add a contact email so visitors can reach the organisation.",
    });
  }

  // Warnings: theme.id outside the canonical set (ADR 0044 corollary 3).
  // The schema accepts any non-empty string so a future or third-party
  // theme round-trips without data loss; this rule surfaces the
  // closed-set expectation as a quality nudge without blocking publish.
  if (!KNOWN_THEME_IDS_FOR_VALIDATION.includes(site.theme.id)) {
    result.warnings.push({
      severity: "warning",
      path: ["theme", "id"],
      code: "site.theme.id.unknown",
      message: `Theme "${site.theme.id}" is not in the built-in theme list (${KNOWN_THEME_IDS_FOR_VALIDATION.join(", ")}).`,
    });
  }

  runArticleRules(site, result, blockContext);
  runArticleReferenceRules(site, result);
  runThemeContrastRules(site, result);
  runOversizedImageRules(site, result);
}

/**
 * Deep-parse and rule-check a block list hanging off `basePath`, rebasing every
 * produced issue onto that path. Shared by Pages and Articles so both surfaces
 * report block problems identically.
 *
 * `context` carries the Draft carve-out. A Block inside a Draft Article is not
 * public content, so the ADR 0048 rules that would otherwise produce a
 * non-overridable export blocker produce an ordinary error there instead —
 * issue #100 is explicit that Draft-only problems must not affect
 * public-export eligibility.
 */
function runBlocksDeep(
  blocks: readonly z.infer<typeof BlockEnvelopeSchema>[],
  basePath: (string | number)[],
  result: ValidationResult,
  context: BlockRuleContext = PUBLIC_BLOCK_CONTEXT,
): void {
  blocks.forEach((block, blockIdx) => {
    if (!isKnownBlockType(block.type)) {
      if (context.customBlocks !== undefined && isCustomBlockType(block.type)) {
        runCustomBlockRules(block, [...basePath, blockIdx], result, context);
      }
      return;
    }
    const knownSchema = KnownBlockSchemas[block.type] as unknown as z.ZodType;
    const known = knownSchema.safeParse(block);
    if (!known.success) {
      for (const issue of known.error.issues) {
        result.errors.push({
          severity: "error",
          path: [...basePath, blockIdx, ...pathFromZod(issue.path)],
          code: `block.${block.type}.${issue.code}`,
          message: issue.message,
        });
      }
      return;
    }
    const childResult = emptyResult();
    runBlockRules(known.data as KnownBlockData, childResult, context);
    for (const issue of [...childResult.errors, ...childResult.warnings, ...childResult.info]) {
      const rebased: ValidationIssue = { ...issue, path: [...basePath, blockIdx, ...issue.path] };
      if (issue.severity === "error") result.errors.push(rebased);
      else if (issue.severity === "warning") result.warnings.push(rebased);
      else result.info.push(rebased);
    }
  });
}

// ---------------------------------------------------------------------------
// Custom Block rules (ADR 0055; docs/plans/issue-106-custom-block-contract.md).
// ---------------------------------------------------------------------------

/**
 * Check one Custom Block against the registry.
 *
 * An unavailable type — package missing, damaged, needing a newer builder, or
 * data saved by a newer package — is a blocking error at the Block itself:
 * the content is preserved, the Inspector shows it as unavailable, and the
 * export stops until the package is restored. The path ends in `data` so the
 * readiness panel's "Fix" opens the Block Inspector, where the reason is
 * explained, rather than the Page settings.
 *
 * An available type's data is checked against its declaration by
 * `checkCustomBlockData`; every content rule there is a warning.
 */
function runCustomBlockRules(
  block: z.infer<typeof BlockEnvelopeSchema>,
  blockPath: (string | number)[],
  result: ValidationResult,
  context: BlockRuleContext,
): void {
  const registry = context.customBlocks;
  if (registry === undefined) return;
  const availability = customBlockAvailabilityFor(registry, block);
  if (availability === undefined) return;
  if (availability.status === "unavailable") {
    result.errors.push({
      severity: "error",
      path: [...blockPath, "data"],
      code: `block.custom.unavailable.${availability.reason}`,
      message: availability.message,
      ...(context.publicContent ? { blocking: true } : {}),
    });
    return;
  }
  const { declaration } = availability;
  if (block.version < declaration.version) {
    result.warnings.push({
      severity: "warning",
      path: [...blockPath, "data"],
      code: "block.custom.version.outdated",
      message:
        `This block was saved with an older version of its package (data version ${block.version}, ` +
        `installed version ${declaration.version}). Your content is kept; fields the newer version added start empty.`,
    });
  }
  const issues = checkCustomBlockData(declaration, block.data, {
    publicContent: context.publicContent,
    assetPathExists: context.assetPathExists,
    resolveLinkTarget: context.resolveLinkTarget,
    checkRichText: (doc, path) => {
      const child = emptyResult();
      runRichTextRules(doc, child, context);
      // `runRichTextRules` reports under `["data", "doc", …]`; rebase onto the
      // field that holds this document. Its "empty section" nudge does not
      // apply: a field's emptiness is the `required` rule's business, and an
      // optional field the author cleared is simply empty.
      return [...child.errors, ...child.warnings, ...child.info]
        .filter((issue) => issue.code !== "block.richText.doc.empty")
        .map((issue) => ({
          ...issue,
          path: [...path, ...issue.path.slice(2)],
          code: issue.code.replace("block.richText.", "block.custom.richText."),
        }));
    },
  });
  for (const issue of issues) {
    const rebased: ValidationIssue = { ...issue, path: [...blockPath, "data", ...issue.path] };
    if (issue.severity === "error") result.errors.push(rebased);
    else if (issue.severity === "warning") result.warnings.push(rebased);
    else result.info.push(rebased);
  }
}

// ---------------------------------------------------------------------------
// Article rules (ADR 0047; docs/plans/issue-97-*, issue-98-*).
// ---------------------------------------------------------------------------

/**
 * Structural and identity rules for `site.articles` and `site.tags`.
 *
 * Cross-references between Articles (explicit list selections) are checked
 * separately in `runArticleReferenceRules`, because whether a broken reference
 * is a warning or an un-overridable export blocker depends on the publication
 * state of whatever *contains* the reference, not on the Article itself.
 */
function runArticleRules(
  site: z.infer<typeof SiteSchema>,
  result: ValidationResult,
  blockContext: BlockRuleContext,
): void {
  const articles = articlesOf(site);
  const tags = site.tags ?? [];

  // Errors: tag ids are the permanent handle every association and filter
  // points at, so duplicates would silently merge two tags.
  const seenTagIds = new Set<string>();
  const seenTagLabels = new Map<string, number>();
  tags.forEach((tag, idx) => {
    if (seenTagIds.has(tag.id)) {
      result.errors.push({
        severity: "error",
        path: ["tags", idx, "id"],
        code: "site.tag.id.duplicate",
        message: `Tag id "${tag.id}" is used more than once.`,
      });
    } else {
      seenTagIds.add(tag.id);
    }
    // Labels differing only in case or surrounding whitespace are duplicates
    // (issue #98). Storage keeps the author's capitalisation, so this is a
    // nudge rather than a rejection of already-persisted data.
    const normalized = normalizeTagLabel(tag.label);
    const firstIdx = seenTagLabels.get(normalized);
    if (firstIdx !== undefined) {
      result.warnings.push({
        severity: "warning",
        path: ["tags", idx, "label"],
        code: "site.tag.label.duplicate",
        message: `Tag "${tag.label}" duplicates an existing tag. Merge them so lists stay predictable.`,
      });
    } else {
      seenTagLabels.set(normalized, idx);
    }
  });

  // Slug reservations per language: an Article's current slug and every slug in
  // its history stay reserved while it exists, including while it is a Draft
  // (ADR 0047). Collect them first so conflicts can name the other Article.
  interface SlugClaim {
    readonly articleIdx: number;
    readonly historical: boolean;
  }
  const claims = new Map<string, SlugClaim>();
  const claimKey = (lang: string, slug: string): string => `${lang}:${slug}`;

  const seenArticleIds = new Set<string>();
  const translationSeats = new Map<string, number>();

  articles.forEach((article, idx) => {
    // Errors: permanent identity must be unique — every reference resolves by id.
    if (seenArticleIds.has(article.id)) {
      result.errors.push({
        severity: "error",
        path: ["articles", idx, "id"],
        code: "site.article.id.duplicate",
        message: `Article id "${article.id}" is used more than once.`,
      });
    } else {
      seenArticleIds.add(article.id);
    }

    // Errors: language must be declared on the site (mirrors the Page rule).
    if (!site.languages.includes(article.lang)) {
      result.errors.push({
        severity: "error",
        path: ["articles", idx, "lang"],
        code: "site.article.lang.notInLanguagesList",
        message: `Article language "${article.lang}" is not in the site's language list.`,
      });
    }

    // Errors: the slug must be a flat, URL-safe segment, same as a Page's.
    const failure = checkSlug(article.slug);
    if (failure !== null) {
      result.errors.push({
        severity: "error",
        path: ["articles", idx, "slug"],
        code: `site.article.${failure.code}`,
        message: failure.message,
      });
    }

    // Errors: slug conflicts within a language, against both current slugs and
    // reserved historical ones.
    const currentKey = claimKey(article.lang, article.slug);
    const existing = claims.get(currentKey);
    if (existing !== undefined) {
      const other = articles[existing.articleIdx];
      result.errors.push({
        severity: "error",
        path: ["articles", idx, "slug"],
        code: existing.historical
          ? "site.article.slug.conflictsWithHistory"
          : "site.article.slug.duplicate",
        message: existing.historical
          ? `Article link "${article.slug}" is a previous link of "${other?.title ?? "another article"}" and stays reserved while that article exists.`
          : `Article link "${article.slug}" is already used in language "${article.lang}".`,
      });
    } else {
      claims.set(currentKey, { articleIdx: idx, historical: false });
    }

    (article.slugHistory ?? []).forEach((old, historyIdx) => {
      if (old === article.slug) {
        result.warnings.push({
          severity: "warning",
          path: ["articles", idx, "slugHistory", historyIdx],
          code: "site.article.slugHistory.containsCurrent",
          message: `Article "${article.title}" lists its current link "${old}" as a previous link.`,
        });
        return;
      }
      const key = claimKey(article.lang, old);
      const prior = claims.get(key);
      if (prior !== undefined && prior.articleIdx !== idx) {
        result.errors.push({
          severity: "error",
          path: ["articles", idx, "slugHistory", historyIdx],
          code: "site.article.slugHistory.conflict",
          message: `Previous article link "${old}" is already claimed by another article in language "${article.lang}".`,
        });
        return;
      }
      if (prior === undefined) claims.set(key, { articleIdx: idx, historical: true });
    });

    // Errors: two Articles in the same translation group cannot share a
    // language — the language switcher would have no way to choose between them.
    const group = article.translationGroup;
    if (group !== undefined) {
      const seatKey = `${group}:${article.lang}`;
      const seat = translationSeats.get(seatKey);
      if (seat !== undefined) {
        result.errors.push({
          severity: "error",
          path: ["articles", idx, "translationGroup"],
          code: "site.article.translationGroup.duplicateLanguage",
          message: `Two articles are linked as the "${article.lang}" version of the same translation set.`,
        });
      } else {
        translationSeats.set(seatKey, idx);
      }
    }

    // Warnings: tag references that no longer resolve. Deleting a tag is meant
    // to strip it from every Article, so this indicates a hand-edited project.
    (article.tags ?? []).forEach((tagId, tagIdx) => {
      if (!seenTagIds.has(tagId)) {
        result.warnings.push({
          severity: "warning",
          path: ["articles", idx, "tags", tagIdx],
          code: "site.article.tag.unknown",
          message: `Article "${article.title}" refers to a tag that no longer exists.`,
        });
      }
    });

    // Warnings: cover image without a description (accessibility nudge; the
    // same tier as every other missing image description, per ADR 0048).
    if (article.cover && !article.coverAlt) {
      result.warnings.push({
        severity: "warning",
        path: ["articles", idx, "coverAlt"],
        code: "site.article.coverAlt.missing",
        message: `The cover image for "${article.title}" needs a short description for people using screen readers.`,
      });
    }

    // Warnings: a Published Article with no content renders as a bare title.
    if (article.state === "published" && article.blocks.length === 0) {
      result.warnings.push({
        severity: "warning",
        path: ["articles", idx, "blocks"],
        code: "site.article.blocks.empty",
        message: `Published article "${article.title}" has no content yet.`,
      });
    }

    // The Draft carve-out, at the one place it can be decided: a Draft is
    // never emitted to the public Site, so nothing inside it can make public
    // output wrong. Unlisted Articles *are* emitted, so they count as public.
    runBlocksDeep(article.blocks, ["articles", idx, "blocks"], result, {
      ...blockContext,
      publicContent: article.state !== "draft",
    });
  });
}

/**
 * Cross-reference rules for configured Article lists.
 *
 * The severity depends on reachability, not on the reference itself:
 *
 *  - A broken explicit selection in **public content** (any Page, or a
 *    Published/Unlisted Article) would put a card linking to nothing into the
 *    exported Site. That is an un-overridable export blocker (ADR 0048).
 *  - The same breakage inside a **Draft** Article, or inside a *disabled*
 *    Related Articles setting, is an editor issue only — a warning that never
 *    stands between the author and an export (issue #97).
 */
function runArticleReferenceRules(
  site: z.infer<typeof SiteSchema>,
  result: ValidationResult,
): void {
  const knownTagIds = new Set((site.tags ?? []).map((tag) => tag.id));

  const check = (
    selection: ArticleSelection,
    basePath: (string | number)[],
    containerLang: string,
    isPublic: boolean,
    containerArticle: Article | undefined,
  ): void => {
    for (const issue of inspectArticleSelection(site, selection)) {
      const path = [...basePath, "articleIds", issue.index];
      if (isPublic) {
        result.errors.push({
          severity: "error",
          blocking: true,
          path,
          code:
            issue.reason === "missing"
              ? "site.articleList.selection.missing"
              : "site.articleList.selection.draft",
          message:
            issue.reason === "missing"
              ? "This list points at an article that no longer exists. Remove it or pick another article."
              : "This list points at a draft article, which is not part of the exported website. Publish it or remove it from the list.",
        });
      } else {
        result.warnings.push({
          severity: "warning",
          path,
          code:
            issue.reason === "missing"
              ? "site.articleList.selection.missing.draftOnly"
              : "site.articleList.selection.draft.draftOnly",
          message:
            issue.reason === "missing"
              ? "This list points at an article that no longer exists. It will need fixing before this draft can be published."
              : "This list points at a draft article. It will need fixing before this draft can be published.",
        });
      }
    }

    // Warnings: a tag filter naming a deleted tag silently widens the list.
    (selection.tags ?? []).forEach((tagId, tagIdx) => {
      if (!knownTagIds.has(tagId)) {
        result.warnings.push({
          severity: "warning",
          path: [...basePath, "tags", tagIdx],
          code: "site.articleList.tag.unknown",
          message: "This list filters on a tag that no longer exists.",
        });
      }
    });

    // Info: an empty list still renders its heading plus "No articles yet",
    // which is valid output but rarely what the author intended.
    const matches = resolveArticleSelection(site, selection, {
      lang: containerLang,
      ...(containerArticle === undefined ? {} : { excludeArticleId: containerArticle.id }),
    });
    if (matches.length === 0) {
      result.info.push({
        severity: "info",
        path: basePath,
        code: "site.articleList.empty",
        message: "This article list currently matches no articles and will show “No articles yet”.",
      });
    }
  };

  site.pages.forEach((page, pageIdx) => {
    page.blocks.forEach((block, blockIdx) => {
      if (block.type !== "articleList") return;
      check(
        block.data as ArticleSelection,
        ["pages", pageIdx, "blocks", blockIdx, "data"],
        page.lang,
        true,
        undefined,
      );
    });
  });

  articlesOf(site).forEach((article, idx) => {
    const isPublic = article.state !== "draft";
    article.blocks.forEach((block, blockIdx) => {
      if (block.type !== "articleList") return;
      check(
        block.data as ArticleSelection,
        ["articles", idx, "blocks", blockIdx, "data"],
        article.lang,
        isPublic,
        article,
      );
    });

    const related = article.relatedArticles;
    // A disabled Related Articles list keeps its settings but leaves public
    // output entirely, so it is excluded from reference checks by design.
    if (related !== undefined && related.enabled) {
      check(related, ["articles", idx, "relatedArticles"], article.lang, isPublic, article);
    }
  });
}

function runThemeContrastRules(site: z.infer<typeof SiteSchema>, result: ValidationResult): void {
  const tokens = site.theme.tokens ?? {};
  const checks: ReadonlyArray<readonly [string, unknown]> = [
    ["colorPrimary", tokens.colorPrimary],
    ["colorAccent", tokens.colorAccent],
  ];
  for (const [tokenName, raw] of checks) {
    if (typeof raw !== "string") continue;
    const ratio = contrastAgainstWhite(raw);
    if (ratio === null || ratio >= MIN_TEXT_CONTRAST_RATIO) continue;
    result.warnings.push({
      severity: "warning",
      path: ["theme", "tokens", tokenName],
      code: "site.theme.tokens.contrast.low",
      message: `${tokenName} may be hard to read on the page background. Use a darker colour.`,
    });
  }
}

function runOversizedImageRules(site: z.infer<typeof SiteSchema>, result: ValidationResult): void {
  for (const issue of collectOversizedImages(site)) {
    result.warnings.push(issue);
  }
}

function contrastAgainstWhite(hex: string): number | null {
  const rgb = parseHexColor(hex);
  if (rgb === null) return null;
  const fg = relativeLuminance(rgb);
  const bg = 1;
  return (bg + 0.05) / (fg + 0.05);
}

function parseHexColor(input: string): readonly [number, number, number] | null {
  const trimmed = input.trim();
  const short = /^#([0-9a-f]{3})$/i.exec(trimmed);
  if (short !== null) {
    const chars = short[1]!;
    return [0, 1, 2].map((idx) => Number.parseInt(chars[idx]! + chars[idx]!, 16)) as [
      number,
      number,
      number,
    ];
  }
  const long = /^#([0-9a-f]{6})$/i.exec(trimmed);
  if (long === null) return null;
  const value = long[1]!;
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function relativeLuminance(rgb: readonly [number, number, number]): number {
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function collectOversizedImages(site: z.infer<typeof SiteSchema>): ValidationIssue[] {
  const warnings: ValidationIssue[] = [];
  visitPotentialAsset(site.org.logo, ["org", "logo"], warnings);
  site.pages.forEach((page, pageIdx) => {
    page.blocks.forEach((block, blockIdx) => {
      visitPotentialAsset(block.data, ["pages", pageIdx, "blocks", blockIdx, "data"], warnings);
    });
  });
  articlesOf(site).forEach((article, articleIdx) => {
    visitPotentialAsset(article.cover, ["articles", articleIdx, "cover"], warnings);
    article.blocks.forEach((block, blockIdx) => {
      visitPotentialAsset(
        block.data,
        ["articles", articleIdx, "blocks", blockIdx, "data"],
        warnings,
      );
    });
  });
  return warnings;
}

function visitPotentialAsset(
  value: unknown,
  path: (string | number)[],
  warnings: ValidationIssue[],
): void {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((item, idx) => visitPotentialAsset(item, [...path, idx], warnings));
    return;
  }
  if (typeof value !== "object") return;

  const record = value as Record<string, unknown>;
  if (isImageAssetRef(record)) {
    const largest = largestKnownImageBytes(record);
    if (largest !== null && largest > IMAGE_WARNING_BUDGET_BYTES) {
      warnings.push({
        severity: "warning",
        path,
        code: "site.asset.image.oversized",
        message: `Image "${record.path}" is ${formatBytes(largest)}. Use an image under ${formatBytes(IMAGE_WARNING_BUDGET_BYTES)} so the page loads faster.`,
      });
    }
    return;
  }

  for (const [key, child] of Object.entries(record)) {
    visitPotentialAsset(child, [...path, key], warnings);
  }
}

function isImageAssetRef(record: Record<string, unknown>): record is Record<string, unknown> & {
  path: string;
  mime: string;
} {
  return (
    typeof record.path === "string" &&
    typeof record.mime === "string" &&
    record.mime.startsWith("image/")
  );
}

function largestKnownImageBytes(record: Record<string, unknown>): number | null {
  const candidates: number[] = [];
  if (typeof record.bytes === "number" && Number.isFinite(record.bytes)) {
    candidates.push(record.bytes);
  }
  if (Array.isArray(record.variants)) {
    for (const variant of record.variants) {
      if (
        variant !== null &&
        typeof variant === "object" &&
        typeof (variant as Record<string, unknown>).bytes === "number" &&
        Number.isFinite((variant as Record<string, unknown>).bytes)
      ) {
        candidates.push((variant as { bytes: number }).bytes);
      }
    }
  }
  if (candidates.length === 0) return null;
  return Math.max(...candidates);
}

function formatBytes(bytes: number): string {
  return `${Math.round(bytes / 1024)} KB`;
}

/**
 * Build the rich-text link resolver for a Site.
 *
 * Pages resolve by their permanent `id`. Articles resolve through
 * `site.articles` when issue #97's data is present, reporting `"draft"`
 * separately from `"missing"` so the author gets the right advice: a Draft
 * target is repairable by publishing it, a missing one by repointing the
 * link. Both render as unlinked text.
 *
 * Both indexes are built once per Site, not once per link: a document can
 * hold many links, and both lookups walk the whole Site.
 */
function makeLinkTargetResolver(
  site: z.infer<typeof SiteSchema>,
): (target: RichTextLinkTarget) => LinkTargetState {
  const pageIds = new Set<string>();
  for (const page of site.pages) {
    if (typeof page.id === "string" && page.id.length > 0) pageIds.add(page.id);
  }

  const articles = articlesById(site);

  return (target: RichTextLinkTarget): LinkTargetState => {
    if (target.kind === "page") return pageIds.has(target.pageId) ? "ok" : "missing";
    if (target.kind === "article") {
      const article = articles.get(target.articleId);
      if (article === undefined) return "missing";
      // Unlisted Articles are legitimate link targets (issue #100); only
      // Drafts are unreachable for visitors.
      return article.state === "draft" ? "draft" : "ok";
    }
    return "ok";
  };
}

/**
 * Rich-text document rules (ADR 0048, issue #100).
 *
 * Four findings, with deliberately different weights:
 *
 * - **Empty document** — warning. A placeholder Block is a normal editing
 *   state, same as the Markdown rule it replaces.
 * - **Unsupported content** — error, blocking in public content. The editor
 *   cannot render it and must not simplify it away, so publishing would drop
 *   the author's words silently.
 * - **Missing image bytes** — error, blocking in public content, for the same
 *   reason. Only checked when the host supplies `assetPathExists`.
 * - **Missing image description / broken link** — warnings. Both still
 *   produce meaningful output (an image with no alt, unlinked text), so they
 *   nudge rather than block.
 */
function runRichTextRules(
  doc: RichTextDocument | undefined,
  result: ValidationResult,
  context: BlockRuleContext,
): void {
  if (doc === undefined) return;

  if (isEmptyRichTextDocument(doc)) {
    result.warnings.push({
      severity: "warning",
      path: ["data", "doc"],
      code: "block.richText.doc.empty",
      message: "This text section is empty. Add content or remove the section.",
    });
  }

  for (const found of collectUnsupportedRichText(doc)) {
    result.errors.push({
      severity: "error",
      path: ["data", "doc", ...found.path],
      code: "block.richText.content.unsupported",
      message:
        `This text section contains "${found.type}" content that this version of the editor ` +
        "cannot show or publish. It has been kept exactly as it was — update the editor to edit it.",
      ...(context.publicContent ? { blocking: true } : {}),
    });
  }

  for (const image of collectRichTextImages(doc)) {
    if (typeof image.asset.alt !== "string" || image.asset.alt.trim().length === 0) {
      result.warnings.push({
        severity: "warning",
        path: ["data", "doc", ...image.path, "alt"],
        code: "block.richText.image.alt.missing",
        message: "This image needs a short description for people using screen readers.",
      });
    }
    if (context.assetPathExists !== undefined && !context.assetPathExists(image.asset.path)) {
      result.errors.push({
        severity: "error",
        path: ["data", "doc", ...image.path],
        code: "block.richText.image.bytes.missing",
        message:
          "The image file for this text section is missing from the project. Upload it again " +
          "or remove the image.",
        ...(context.publicContent ? { blocking: true } : {}),
      });
    }
  }

  // External addresses need no rule here: the document schema accepts exactly
  // what the Renderer will link (see `RichTextExternalLinkSchema`), so an
  // unusable one is a schema error on the Block, never a silent drop.
  if (context.resolveLinkTarget !== undefined) {
    for (const link of collectRichTextLinkTargets(doc)) {
      if (link.target.kind === "external") continue;
      const state = context.resolveLinkTarget(link.target);
      if (state === "ok") continue;
      result.warnings.push({
        severity: "warning",
        path: ["data", "doc", ...link.path],
        code: state === "draft" ? "block.richText.link.draft" : "block.richText.link.missing",
        message:
          state === "draft"
            ? "A link in this text section points at a Draft, which visitors cannot open. " +
              "It will show as plain text until the Draft is published."
            : "A link in this text section points at something that no longer exists. " +
              "It will show as plain text until you repoint it.",
      });
    }
  }
}

function runBlockRules(
  block: KnownBlockData,
  result: ValidationResult,
  context: BlockRuleContext = PUBLIC_BLOCK_CONTEXT,
): void {
  // The discriminator (`block.type`) survives schema-level `looseObject`
  // because each known block declares it as `z.literal(...)`. The switch
  // covers every entry of `KnownBlockSchemas`; the default branch is
  // unreachable for known types and is only here as a defensive no-op for
  // future block types that arrive in the registry before this switch is
  // updated.
  switch (block.type) {
    case "hero": {
      // Warning: a hero with a background image but no alt text is an
      // accessibility nudge, not a hard error (per PRD severity model).
      if (block.data.backgroundImage && !block.data.backgroundAlt) {
        result.warnings.push({
          severity: "warning",
          path: ["data", "backgroundAlt"],
          code: "block.hero.backgroundAlt.missing",
          message:
            "The page header image needs a short description for people using screen readers.",
        });
      }
      break;
    }
    case "valueList": {
      // Quality nudge: a valueList with zero items renders as nothing useful.
      // Schema-allowed (an empty array is a valid array); we surface it as a
      // warning so the editor can prompt without blocking publish.
      if (block.data.items.length === 0) {
        result.warnings.push({
          severity: "warning",
          path: ["data", "items"],
          code: "block.valueList.items.empty",
          message:
            "This values section has no items. Add at least one value or remove the section.",
        });
      }
      break;
    }
    case "contactCard": {
      // Warning: a contactCard with neither email nor phone is a low-value
      // card. Address-only cards still publish, but we nudge the user to
      // expose at least one reachable channel.
      const hasEmail = typeof block.data.email === "string" && block.data.email.trim().length > 0;
      const hasPhone = typeof block.data.phone === "string" && block.data.phone.trim().length > 0;
      if (!hasEmail && !hasPhone) {
        result.warnings.push({
          severity: "warning",
          path: ["data"],
          code: "block.contactCard.contact.missing",
          message:
            "This contact section needs an email or phone number so visitors can reach the organisation.",
        });
      }
      break;
    }
    case "embed": {
      // Schema-level validation already enforces title presence and URL/provider
      // match. A future quality nudge could warn on very short titles; not
      // included today.
      break;
    }
    case "customHTML": {
      // Warning: sanitize-off is a deliberate-danger opt-in. The editor
      // surfaces a persistent warning UI inline; this validation issue lets
      // the Site Health panel and the validation report record it too.
      if (block.data.sanitize === false) {
        result.warnings.push({
          severity: "warning",
          path: ["data", "sanitize"],
          code: "block.customHTML.sanitize.off",
          message:
            "The custom code safety filter is off. Only keep it off for code checked by someone technical.",
        });
      }
      break;
    }
    case "activitiesList": {
      // No additional warnings beyond schema parse: alt enforcement on
      // images is encoded in `ActivityImageRefSchema` (alt is `min(1)`),
      // so a missing/empty alt is already an `error`-tier issue. The
      // upload-time alt check in `@sosb/assets` (#8) is the matching
      // enforcement at write time.
      break;
    }
    case "teamGrid": {
      // Warning: every person photo carries an alt; an empty alt is a quality
      // nudge (mirroring the hero's missing-alt rule). Schema accepts empty
      // alt so a stale import does not hard-error; the editor should surface
      // these for the user to fix.
      block.data.people.forEach((person, idx) => {
        if (person.photo && person.photo.alt.trim().length === 0) {
          result.warnings.push({
            severity: "warning",
            path: ["data", "people", idx, "photo", "alt"],
            code: "block.teamGrid.photo.alt.missing",
            message: `Team member "${person.name}" has a photo that needs a short image description.`,
          });
        }
      });
      break;
    }
    case "richText": {
      runRichTextRules(block.data.doc as RichTextDocument | undefined, result, context);
      break;
    }
    case "quote": {
      // Warning: an authorImage with no alt text is an accessibility nudge,
      // mirroring the hero `backgroundAlt` rule. The schema does not require
      // alt text (so the block can be authored before the alt is written),
      // but the editor surfaces this warning so the user is reminded.
      if (block.data.authorImage && !block.data.authorImageAlt) {
        result.warnings.push({
          severity: "warning",
          path: ["data", "authorImageAlt"],
          code: "block.quote.authorImageAlt.missing",
          message:
            "The quote author image needs a short description for people using screen readers.",
        });
      }
      break;
    }
    case "faq": {
      // Warning: an FAQ block with no items is a quality nudge — the
      // schema accepts the empty case so a placeholder block can sit on a
      // page before items are written, but a published FAQ with zero items
      // is a content gap worth surfacing.
      if (block.data.items.length === 0) {
        result.warnings.push({
          severity: "warning",
          path: ["data", "items"],
          code: "block.faq.items.empty",
          message:
            "This FAQ section has no questions. Add a question and answer or remove the section.",
        });
      }
      // Warning: any item with an empty answer is a quality nudge — the
      // question is asked but unanswered, which is a publish-blocker for
      // visitors. We still allow it through so partial drafts can be saved.
      block.data.items.forEach((item, idx) => {
        if (typeof item.answer !== "string" || item.answer.trim().length === 0) {
          result.warnings.push({
            severity: "warning",
            path: ["data", "items", idx, "answer"],
            code: "block.faq.item.answer.empty",
            message: `Question "${item.question}" has no answer. Fill it in before downloading.`,
          });
        }
      });
      break;
    }
    case "ctaBanner": {
      // Warning: a ctaBanner whose backgroundImage AssetRef has empty alt
      // text is an accessibility nudge — same severity model as hero.
      const bg = block.data.backgroundImage as { alt?: unknown } | undefined;
      if (bg !== undefined) {
        const alt = typeof bg.alt === "string" ? bg.alt : "";
        if (alt.trim().length === 0) {
          result.warnings.push({
            severity: "warning",
            path: ["data", "backgroundImage", "alt"],
            code: "block.ctaBanner.backgroundImage.alt.missing",
            message:
              "The action banner background image needs a short description for people using screen readers.",
          });
        }
      }
      break;
    }
    case "partnerLogos": {
      // No warnings v1: the schema already enforces non-empty partner names
      // (the alt-text source) and AssetRef alt fields.
      break;
    }
    case "imageGallery": {
      // Schema-level alt enforcement is already an `error` via the schema's
      // `min(1)` rule. Block-level rules are reserved for quality nudges
      // that the schema cannot express; v1 leaves this branch as the
      // exhaustiveness anchor.
      break;
    }
    case "documentDownloads": {
      // No quality nudges in v1. The schema previously enforced
      // `min(1)` on the files array; T19 (ADR 0044 Corollary 2) relaxed
      // this so a freshly-added documentDownloads block can start with
      // zero files (the DocumentPicker owns the empty-state UX). Every
      // individual file's `label` is still parse-time enforced as
      // non-empty, and the upload pipeline (#21) enforces label / size
      // / mime at upload time. A future warning-tier rule for "this
      // block has no content" would land here.
      break;
    }
    case "eventList": {
      block.data.events.forEach((event, idx) => {
        if (event.image && !event.imageAlt) {
          result.warnings.push({
            severity: "warning",
            path: ["data", "events", idx, "imageAlt"],
            code: "block.eventList.event.imageAlt.missing",
            message: `Event "${event.title}" has an image that needs a short description.`,
          });
        }
      });
      break;
    }
    case "siteFooter": {
      // No quality nudges in v1. The footer may intentionally contain only
      // contact links, only a membership mark, or both.
      break;
    }
    case "articleList": {
      // Context-free nudges only. Whether a selection actually resolves depends
      // on the whole Site and on where the block sits, so those checks live in
      // `runArticleReferenceRules` — `runBlockRules` sees one block in isolation
      // and is also reachable through `validateBlock`, which has no Site at all.
      const mode = block.data.mode ?? DEFAULT_ARTICLE_LIST_MODE;
      if (mode === "selected" && (block.data.articleIds ?? []).length === 0) {
        result.warnings.push({
          severity: "warning",
          path: ["data", "articleIds"],
          code: "block.articleList.articleIds.empty",
          message: "No articles are selected yet, so this list will be empty.",
        });
      }
      break;
    }
    default: {
      // Exhaustiveness assertion: every known block must have a case branch.
      const _exhaustive: never = block;
      void _exhaustive;
      break;
    }
  }
}
