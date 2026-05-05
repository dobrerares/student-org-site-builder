import type { ZodSafeParseResult } from "zod";
import { z } from "zod";
import {
  BlockEnvelopeSchema,
  KnownBlockSchemas,
  isKnownBlockType,
  type KnownBlockType,
} from "./blocks/index.js";
import { SiteSchema } from "./site.js";

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

function zodIssuesToErrors<T>(
  parseResult: ZodSafeParseResult<T>,
  codePrefix: string,
): ValidationIssue[] {
  if (parseResult.success) return [];
  return parseResult.error.issues.map((issue) => ({
    severity: "error" as const,
    path: pathFromZod(issue.path),
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
    // The registry lookup produces a per-type schema (`HeroBlockSchema`,
    // `RichTextBlockSchema`, …); their parse-result types form a union we
    // erase here so the generic `zodIssuesToErrors` accepts it. The block-
    // type narrowing below is preserved for the rule-runner call.
    const knownSchema = KnownBlockSchemas[block.type] as (typeof KnownBlockSchemas)[KnownBlockType];
    const knownParse = knownSchema.safeParse(data) as ZodSafeParseResult<unknown>;
    result.errors.push(...zodIssuesToErrors(knownParse, `block.${block.type}`));
    if (knownParse.success) {
      runBlockRules(
        knownParse.data as z.infer<(typeof KnownBlockSchemas)[KnownBlockType]>,
        result,
      );
    }
  } else {
    // Unknown block type: envelope already passed, so the data round-trips.
    // No extra rules to run.
  }

  return finalize(result);
}

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

  // Warnings: each known block on each page is rule-checked too.
  site.pages.forEach((page, pageIdx) => {
    page.blocks.forEach((block, blockIdx) => {
      if (isKnownBlockType(block.type)) {
        const knownSchema = KnownBlockSchemas[block.type] as (typeof KnownBlockSchemas)[KnownBlockType];
        const known = knownSchema.safeParse(block) as ZodSafeParseResult<unknown>;
        if (known.success) {
          const childResult = emptyResult();
          runBlockRules(
            known.data as z.infer<(typeof KnownBlockSchemas)[KnownBlockType]>,
            childResult,
          );
          for (const issue of [
            ...childResult.errors,
            ...childResult.warnings,
            ...childResult.info,
          ]) {
            const rebased: ValidationIssue = {
              ...issue,
              path: ["pages", pageIdx, "blocks", blockIdx, ...issue.path],
            };
            if (issue.severity === "error") result.errors.push(rebased);
            else if (issue.severity === "warning") result.warnings.push(rebased);
            else result.info.push(rebased);
          }
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
}

function runBlockRules(
  block: z.infer<(typeof KnownBlockSchemas)[keyof typeof KnownBlockSchemas]>,
  result: ValidationResult,
): void {
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
    default: {
      // Exhaustiveness: every known block has a case branch above. The
      // unreachable default is left empty; an unrecognised type would have
      // failed `isKnownBlockType` at the call site and never arrive here.
      break;
    }
  }
}
