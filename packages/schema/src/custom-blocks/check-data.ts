/**
 * Checking saved Custom Block data against its declaration (ADR 0055).
 *
 * Every content rule here is a **warning**: authors save unfinished work,
 * review the problems beside the fields and in the export readiness panel,
 * and may export after accepting them (issue-106 plan, "supported validation
 * rules"). Nothing is truncated or removed — a list with six entries against
 * a limit of five keeps all six — and a Theme design must handle values that
 * fail these rules without crashing.
 *
 * Two findings are not content rules and keep the severity the rest of the
 * builder gives them: an image whose bytes are missing from the project and
 * unsupported Rich-text content are errors that block a public export
 * (ADR 0048's reasoning applies unchanged — publishing would silently drop
 * the author's work).
 *
 * Paths are relative to the Block's `data`; the caller rebases them.
 */

import type { ValidationIssue } from "../validate.js";
import {
  isEmptyRichTextDocument,
  type RichTextDocument,
  type RichTextLinkTarget,
} from "../rich-text-doc.js";
import {
  localizedText,
  type CustomBlockDeclaration,
  type CustomBlockField,
} from "./declaration.js";

export interface CustomBlockCheckContext {
  readonly publicContent: boolean;
  readonly assetPathExists?: ((path: string) => boolean) | undefined;
  readonly resolveLinkTarget?:
    | ((target: RichTextLinkTarget) => "ok" | "missing" | "draft")
    | undefined;
  /**
   * The Rich-text document rules, supplied by `validate.ts` so the two
   * modules do not import each other. Receives the document and the path
   * of the field holding it (relative to `data`).
   */
  readonly checkRichText?:
    | ((doc: RichTextDocument | undefined, path: readonly (string | number)[]) => ValidationIssue[])
    | undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAssetLike(value: unknown): value is { path: string; alt?: unknown } {
  return isRecord(value) && typeof value["path"] === "string" && value["path"].length > 0;
}

function isLinkLike(value: unknown): value is RichTextLinkTarget {
  if (!isRecord(value)) return false;
  const kind = value["kind"];
  return kind === "page" || kind === "article" || kind === "external";
}

function isRichTextLike(value: unknown): value is RichTextDocument {
  return isRecord(value) && Array.isArray(value["content"]);
}

/** Does this saved value count as content the author wrote? */
export function customBlockFieldIsEmpty(field: CustomBlockField, value: unknown): boolean {
  switch (field.kind) {
    case "text":
      return typeof value !== "string" || value.trim().length === 0;
    case "richText":
      return !isRichTextLike(value) || isEmptyRichTextDocument(value);
    case "number":
      return typeof value !== "number" || !Number.isFinite(value);
    case "boolean":
      return typeof value !== "boolean";
    case "choice":
      return typeof value !== "string" || value.length === 0;
    case "link":
      return !isLinkLike(value);
    case "image":
    case "document":
      return !isAssetLike(value);
    case "group":
      return (
        !isRecord(value) || field.fields.every((f) => customBlockFieldIsEmpty(f, value[f.name]))
      );
    case "list":
      return !Array.isArray(value) || value.length === 0;
  }
}

/** Is the saved value the shape this field kind stores? Empty is always acceptable. */
function hasExpectedShape(field: CustomBlockField, value: unknown): boolean {
  if (value === undefined || value === null) return true;
  switch (field.kind) {
    case "text":
    case "choice":
      return typeof value === "string";
    case "richText":
      return isRichTextLike(value);
    case "number":
      return typeof value === "number";
    case "boolean":
      return typeof value === "boolean";
    case "link":
      return isLinkLike(value);
    case "image":
    case "document":
      return isAssetLike(value);
    case "group":
      return isRecord(value);
    case "list":
      return Array.isArray(value);
  }
}

function label(field: CustomBlockField): string {
  return localizedText(field.label, "en");
}

/** Check one Block's `data` against its declaration. */
export function checkCustomBlockData(
  declaration: CustomBlockDeclaration,
  data: unknown,
  context: CustomBlockCheckContext,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const root = isRecord(data) ? data : {};
  checkGroup(declaration.fields, root, [], issues, context);
  return issues;
}

function checkGroup(
  fields: readonly CustomBlockField[],
  data: Record<string, unknown>,
  base: readonly (string | number)[],
  issues: ValidationIssue[],
  context: CustomBlockCheckContext,
): void {
  for (const field of fields) {
    const path = [...base, field.name];
    const value = data[field.name];

    if (!hasExpectedShape(field, value)) {
      // Content is preserved exactly as saved (ADR 0002); the form shows the
      // field as empty and a design should treat it that way too.
      issues.push({
        severity: "warning",
        path,
        code: "block.custom.field.shape",
        message: `"${label(field)}" holds a value this field cannot show. It is kept as it was; enter a new value to replace it.`,
      });
      continue;
    }

    const required = "required" in field && field.required === true;
    if (required && customBlockFieldIsEmpty(field, value)) {
      issues.push({
        severity: "warning",
        path,
        code: "block.custom.field.required",
        message: `"${label(field)}" is required but empty.`,
      });
    }

    switch (field.kind) {
      case "text": {
        if (
          field.maxLength !== undefined &&
          typeof value === "string" &&
          value.length > field.maxLength
        ) {
          issues.push({
            severity: "warning",
            path,
            code: "block.custom.field.maxLength",
            message: `"${label(field)}" is ${value.length} characters long; the limit is ${field.maxLength}. Nothing is cut off — shorten it if you can.`,
          });
        }
        break;
      }
      case "number": {
        if (typeof value === "number") {
          if (field.min !== undefined && value < field.min) {
            issues.push({
              severity: "warning",
              path,
              code: "block.custom.field.range",
              message: `"${label(field)}" is ${value}; the smallest allowed value is ${field.min}.`,
            });
          }
          if (field.max !== undefined && value > field.max) {
            issues.push({
              severity: "warning",
              path,
              code: "block.custom.field.range",
              message: `"${label(field)}" is ${value}; the largest allowed value is ${field.max}.`,
            });
          }
        }
        break;
      }
      case "choice": {
        if (
          typeof value === "string" &&
          value.length > 0 &&
          !field.options.some((option) => option.value === value)
        ) {
          issues.push({
            severity: "warning",
            path,
            code: "block.custom.choice.unknown",
            message: `"${label(field)}" is set to "${value}", which is not one of its options any more. Pick another option.`,
          });
        }
        break;
      }
      case "link": {
        if (isLinkLike(value) && value.kind !== "external" && context.resolveLinkTarget) {
          const state = context.resolveLinkTarget(value);
          if (state !== "ok") {
            issues.push({
              severity: "warning",
              path,
              code: state === "draft" ? "block.custom.link.draft" : "block.custom.link.missing",
              message:
                state === "draft"
                  ? `"${label(field)}" points at a Draft, which visitors cannot open. It will show without a link until the Draft is published.`
                  : `"${label(field)}" points at a page or article that no longer exists. It will show without a link until you choose another one or remove it.`,
            });
          }
        }
        break;
      }
      case "image": {
        if (isAssetLike(value)) {
          const alt = value.alt;
          if (typeof alt !== "string" || alt.trim().length === 0) {
            issues.push({
              severity: "warning",
              path: [...path, "alt"],
              code: "block.custom.image.alt.missing",
              message: `The image in "${label(field)}" needs a short description for people using screen readers.`,
            });
          }
          if (context.assetPathExists !== undefined && !context.assetPathExists(value.path)) {
            issues.push({
              severity: "error",
              path,
              code: "block.custom.image.bytes.missing",
              message: `The image file for "${label(field)}" is missing from the project. Upload it again or remove the image.`,
              ...(context.publicContent ? { blocking: true } : {}),
            });
          }
        }
        break;
      }
      case "document": {
        if (
          isAssetLike(value) &&
          context.assetPathExists !== undefined &&
          !context.assetPathExists(value.path)
        ) {
          issues.push({
            severity: "error",
            path,
            code: "block.custom.document.bytes.missing",
            message: `The file for "${label(field)}" is missing from the project. Upload it again or remove it.`,
            ...(context.publicContent ? { blocking: true } : {}),
          });
        }
        break;
      }
      case "richText": {
        if (context.checkRichText !== undefined && isRichTextLike(value)) {
          issues.push(...context.checkRichText(value, path));
        }
        break;
      }
      case "group": {
        if (isRecord(value)) checkGroup(field.fields, value, path, issues, context);
        break;
      }
      case "list": {
        const entries = Array.isArray(value) ? value : [];
        if (field.minItems !== undefined && entries.length < field.minItems) {
          issues.push({
            severity: "warning",
            path,
            code: "block.custom.list.size",
            message: `"${label(field)}" has ${entries.length} ${entries.length === 1 ? "entry" : "entries"}; at least ${field.minItems} ${field.minItems === 1 ? "is" : "are"} expected.`,
          });
        }
        if (field.maxItems !== undefined && entries.length > field.maxItems) {
          issues.push({
            severity: "warning",
            path,
            code: "block.custom.list.size",
            message: `"${label(field)}" has ${entries.length} entries; the limit is ${field.maxItems}. Nothing is removed — the design will show them all.`,
          });
        }
        entries.forEach((entry, index) => {
          if (isRecord(entry)) {
            checkGroup(field.item.fields, entry, [...path, index], issues, context);
          } else {
            issues.push({
              severity: "warning",
              path: [...path, index],
              code: "block.custom.field.shape",
              message: `Entry ${index + 1} of "${label(field)}" holds a value this list cannot show. It is kept as it was.`,
            });
          }
        });
        break;
      }
      default:
        break;
    }
  }
}
