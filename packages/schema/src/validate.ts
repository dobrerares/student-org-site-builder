import { z } from "zod";
import { BlockEnvelopeSchema, KnownBlockSchemas, isKnownBlockType } from "./blocks/index.js";
import { SiteSchema } from "./site.js";
import { checkSlug } from "./slug.js";

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
}

export interface ValidationResult {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
  /** Convenience: `errors.length === 0`. */
  ok: boolean;
}

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
export function validate(data: unknown): ValidationResult {
  const result = emptyResult();

  const siteParse = SiteSchema.safeParse(data);
  result.errors.push(...zodIssuesToErrors(siteParse, "site"));

  if (siteParse.success) {
    runSiteRules(siteParse.data, result);
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

function runSiteRules(site: z.infer<typeof SiteSchema>, result: ValidationResult): void {
  // Errors: every page's `lang` must appear in the languages list.
  site.pages.forEach((page, idx) => {
    if (!site.languages.includes(page.lang)) {
      result.errors.push({
        severity: "error",
        path: ["pages", idx, "lang"],
        code: "site.page.lang.notInLanguagesList",
        message: `Page lang "${page.lang}" is not declared in site.languages.`,
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
        message: `Page slug "${page.slug}" is used twice in language "${page.lang}".`,
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
            message: `Page "${page.slug}" lists its own language "${otherLang}" in localizedAs.`,
          });
          continue;
        }
        if (!site.languages.includes(otherLang)) {
          result.errors.push({
            severity: "error",
            path: ["pages", idx, "localizedAs", otherLang],
            code: "site.page.localizedAs.unknownLanguage",
            message: `Page "${page.slug}" references undeclared language "${otherLang}" in localizedAs.`,
          });
          continue;
        }
        const slugsForLang = langSlugs.get(otherLang) ?? new Set<string>();
        if (!slugsForLang.has(counterpartSlug)) {
          result.errors.push({
            severity: "error",
            path: ["pages", idx, "localizedAs", otherLang],
            code: "site.page.localizedAs.unknownCounterpart",
            message: `Page "${page.slug}" references "${counterpartSlug}" in language "${otherLang}", but no such page exists.`,
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
          message: `Page "${page.slug}" has no counterpart in language(s): ${missing.join(", ")}.`,
        });
      }
    }
  });

  // Errors + warnings: each known block on each page is parsed against
  // its specific schema (deeper than the envelope) and rule-checked.
  // Deep-schema parse failures become `error` issues with paths rebased
  // onto the site, so callers see schema violations regardless of where
  // they nest. Quality nudges (warnings) come from `runBlockRules`.
  site.pages.forEach((page, pageIdx) => {
    page.blocks.forEach((block, blockIdx) => {
      if (isKnownBlockType(block.type)) {
        const knownSchema = KnownBlockSchemas[block.type] as unknown as z.ZodType;
        const known = knownSchema.safeParse(block);
        if (!known.success) {
          for (const issue of known.error.issues) {
            result.errors.push({
              severity: "error",
              path: ["pages", pageIdx, "blocks", blockIdx, ...pathFromZod(issue.path)],
              code: `block.${block.type}.${issue.code}`,
              message: issue.message,
            });
          }
          return;
        }
        const childResult = emptyResult();
        runBlockRules(
          known.data as z.infer<(typeof KnownBlockSchemas)[keyof typeof KnownBlockSchemas]>,
          childResult,
        );
        for (const issue of [...childResult.errors, ...childResult.warnings, ...childResult.info]) {
          const rebased: ValidationIssue = {
            ...issue,
            path: ["pages", pageIdx, "blocks", blockIdx, ...issue.path],
          };
          if (issue.severity === "error") result.errors.push(rebased);
          else if (issue.severity === "warning") result.warnings.push(rebased);
          else result.info.push(rebased);
        }
      }
    });
  });

  // Warnings: missing org email is a quality nudge per the PRD.
  if (!site.org.email || site.org.email.trim().length === 0) {
    result.warnings.push({
      severity: "warning",
      path: ["org", "email"],
      code: "site.org.email.missing",
      message: "Organisation email is empty. Add a contact address.",
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
      message: `Theme id "${site.theme.id}" is not one of the canonical themes (${KNOWN_THEME_IDS_FOR_VALIDATION.join(", ")}).`,
    });
  }
}

function runBlockRules(block: KnownBlockData, result: ValidationResult): void {
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
            "Hero has a background image but no alt text. Add alt text for screen-reader users.",
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
          message: "valueList has no items. Add at least one value to make this block meaningful.",
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
            "contactCard has neither email nor phone. Add at least one contact channel so visitors can reach the organisation.",
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
            "Custom HTML block has sanitization disabled. Raw HTML will be rendered without protection — only use for trusted content.",
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
            message: `Team member "${person.name}" has a photo but no alt text. Add alt text for screen-reader users.`,
          });
        }
      });
      break;
    }
    case "richText": {
      // Warning: a richText block with no prose is a quality nudge, not a
      // hard error (the schema accepts the empty case so a placeholder
      // block can be added before the user has written content).
      const md = block.data.markdown;
      if (typeof md !== "string" || md.trim().length === 0) {
        result.warnings.push({
          severity: "warning",
          path: ["data", "markdown"],
          code: "block.richText.markdown.empty",
          message: "richText block has no content. Add prose or remove the block.",
        });
      }
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
            "Quote block has an author image but no alt text. Add alt text for screen-reader users.",
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
          message: "FAQ block has no items. Add a question/answer pair or remove the block.",
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
            message: `FAQ item "${item.question}" has no answer. Fill it in before publishing.`,
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
              "ctaBanner background image has no alt text. Add alt text for screen-reader users.",
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
      // No quality nudges in v1. The schema's `min(1)` on files and on
      // every label is enforced at parse-time as errors; the upload
      // pipeline (#21) enforces label / size / mime at upload time. If
      // future user-research surfaces nudges (missing description on a
      // doc, etc.) they land here.
      break;
    }
    case "eventList": {
      // No quality nudges defined for v1. The schema-level checks (ISO 8601
      // with offset, non-empty title/id, closed enums) are the entire
      // contract. Future warnings (e.g. missing image alt on individual
      // events, "all events are in the past — consider hiding the block")
      // can layer on without changing this signature.
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
