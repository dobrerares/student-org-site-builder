/**
 * Custom Block declarations (ADR 0055; issue-106 plan).
 *
 * A developer-authored package declares a Custom Block type in a
 * `block.json`: a permanent namespaced type id, a friendly label with
 * translations, a data-format version, and the fields the builder generates
 * an editing form from. The builder owns every control (ADR 0046: extensions
 * "do not supply executable custom editing interfaces"), so the vocabulary
 * here is the whole of what a declaration can ask for.
 *
 * The schema lives in `@sosb/schema` rather than in the package loader
 * because `validate()` has to check saved Block data against declarations,
 * and this package sits below everything else. `@sosb/theme-package` parses
 * `block.json` files through `parseCustomBlockDeclaration` and hands the
 * results to the renderer's `ThemeBundle`; the editor derives its registry
 * from the installed bundles.
 *
 * Two shapes are deliberately shared with the rest of the builder rather than
 * invented here: a `link` field stores a **Link target** exactly as prose
 * links do (ADR 0048 — `{ kind: "page", pageId } | { kind: "article",
 * articleId } | { kind: "external", href }`), and a `richText` field stores a
 * Rich-text document. One identity model for links means a Page rename
 * cannot break a Custom Block link any more than it can break a paragraph's.
 */

import { z } from "zod";

/** The only declaration format this builder understands. */
export const CUSTOM_BLOCK_DECLARATION_FORMAT_VERSION = 1 as const;

/**
 * A Custom Block type id: a namespace (one or more dot-separated lowercase
 * segments) and a name, joined by a slash — `campus-tools/partners`,
 * `org.example/partners`. The slash is what makes a Custom Block type
 * recognisable on sight and impossible to confuse with a built-in type
 * (`partnerLogos`) or a Theme package id (`org.example.practice`).
 */
export const CUSTOM_BLOCK_TYPE_RE =
  /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Is this Block type a Custom Block type (as opposed to built-in or unknown)? */
export function isCustomBlockType(type: string): boolean {
  return CUSTOM_BLOCK_TYPE_RE.test(type);
}

/**
 * A field name: a JavaScript-style identifier, because the name is the key
 * in saved Block data and the property a design reads (`input.data.heading`).
 */
export const CUSTOM_BLOCK_FIELD_NAME_RE = /^[a-z][A-Za-z0-9]*$/;

/** The agreed field vocabulary (issue-106 plan, "starting field vocabulary"). */
export const CUSTOM_BLOCK_FIELD_KINDS = [
  "text",
  "richText",
  "number",
  "boolean",
  "choice",
  "link",
  "image",
  "document",
  "group",
  "list",
] as const;
export type CustomBlockFieldKind = (typeof CUSTOM_BLOCK_FIELD_KINDS)[number];

/** How deep groups and lists may nest, and how many fields one type may declare. */
export const CUSTOM_BLOCK_MAX_DEPTH = 5;
export const CUSTOM_BLOCK_MAX_FIELDS = 100;

/**
 * Editing copy with translations: a plain string is the default; an object
 * carries the default under `default` plus one entry per editor locale. A
 * missing translation falls back to the default (issue-106 plan, "translated
 * editing labels"). These strings are for the *editor*; they never reach the
 * published Site.
 */
export const LocalizedTextSchema = z.union([
  z.string().min(1),
  z.looseObject({ default: z.string().min(1) }),
]);
export type LocalizedText = z.infer<typeof LocalizedTextSchema>;

/** Resolve editing copy for a locale, falling back to the declaration's default. */
export function localizedText(value: LocalizedText | undefined, locale: string): string {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  const translated = (value as Record<string, unknown>)[locale];
  return typeof translated === "string" && translated.length > 0 ? translated : value.default;
}

const FieldNameSchema = z
  .string()
  .min(1)
  .regex(CUSTOM_BLOCK_FIELD_NAME_RE, "must be an identifier such as 'heading' or 'partnerName'");

const CommonFieldShape = {
  name: FieldNameSchema,
  label: LocalizedTextSchema,
  help: LocalizedTextSchema.optional(),
};

export const CustomBlockTextFieldSchema = z.looseObject({
  ...CommonFieldShape,
  kind: z.literal("text"),
  required: z.boolean().optional(),
  maxLength: z.number().int().positive().optional(),
});

export const CustomBlockRichTextFieldSchema = z.looseObject({
  ...CommonFieldShape,
  kind: z.literal("richText"),
  required: z.boolean().optional(),
});

export const CustomBlockNumberFieldSchema = z
  .looseObject({
    ...CommonFieldShape,
    kind: z.literal("number"),
    required: z.boolean().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
  })
  .refine((f) => f.min === undefined || f.max === undefined || f.min <= f.max, {
    message: "min must not be greater than max",
    path: ["max"],
  });

export const CustomBlockBooleanFieldSchema = z.looseObject({
  ...CommonFieldShape,
  kind: z.literal("boolean"),
  /** Starting value for a new Block. Never applied to saved content. */
  default: z.boolean().optional(),
});

export const CustomBlockChoiceOptionSchema = z.looseObject({
  value: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/i, "must be a short token such as 'wide' or 'two-up'"),
  label: LocalizedTextSchema,
});

export const CustomBlockChoiceFieldSchema = z
  .looseObject({
    ...CommonFieldShape,
    kind: z.literal("choice"),
    options: z.array(CustomBlockChoiceOptionSchema).min(1),
    required: z.boolean().optional(),
    /** Starting value for a new Block; must name one of the options. */
    default: z.string().min(1).optional(),
  })
  .refine((f) => f.default === undefined || f.options.some((o) => o.value === f.default), {
    message: "default must be one of the declared option values",
    path: ["default"],
  })
  .refine((f) => new Set(f.options.map((o) => o.value)).size === f.options.length, {
    message: "option values must be distinct",
    path: ["options"],
  });

export const CustomBlockLinkFieldSchema = z.looseObject({
  ...CommonFieldShape,
  kind: z.literal("link"),
  required: z.boolean().optional(),
});

export const CustomBlockImageFieldSchema = z.looseObject({
  ...CommonFieldShape,
  kind: z.literal("image"),
  required: z.boolean().optional(),
});

export const CustomBlockDocumentFieldSchema = z.looseObject({
  ...CommonFieldShape,
  kind: z.literal("document"),
  required: z.boolean().optional(),
});

/**
 * The recursive field union. `group` and `list` refer back to it, so the
 * union is built lazily; the TypeScript type is written out by hand because
 * `z.infer` cannot name a recursive type on its own.
 */
export type CustomBlockField =
  | z.infer<typeof CustomBlockTextFieldSchema>
  | z.infer<typeof CustomBlockRichTextFieldSchema>
  | z.infer<typeof CustomBlockNumberFieldSchema>
  | z.infer<typeof CustomBlockBooleanFieldSchema>
  | z.infer<typeof CustomBlockChoiceFieldSchema>
  | z.infer<typeof CustomBlockLinkFieldSchema>
  | z.infer<typeof CustomBlockImageFieldSchema>
  | z.infer<typeof CustomBlockDocumentFieldSchema>
  | CustomBlockGroupField
  | CustomBlockListField;

export interface CustomBlockGroupField {
  readonly kind: "group";
  readonly name: string;
  readonly label: LocalizedText;
  readonly help?: LocalizedText | undefined;
  readonly fields: readonly CustomBlockField[];
  readonly [key: string]: unknown;
}

export interface CustomBlockListField {
  readonly kind: "list";
  readonly name: string;
  readonly label: LocalizedText;
  readonly help?: LocalizedText | undefined;
  /**
   * What one entry holds. Always a group in this contract: a list of bare
   * values (a list of images with nothing beside them) is deferred, and a
   * group with one field expresses it without a second storage shape.
   */
  readonly item: { readonly kind: "group"; readonly fields: readonly CustomBlockField[] };
  /** Editing copy for one entry — "Partner" — used by the add button. */
  readonly itemLabel?: LocalizedText | undefined;
  readonly minItems?: number | undefined;
  readonly maxItems?: number | undefined;
  readonly [key: string]: unknown;
}

export const CustomBlockFieldSchema: z.ZodType<CustomBlockField> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    CustomBlockTextFieldSchema,
    CustomBlockRichTextFieldSchema,
    CustomBlockNumberFieldSchema,
    CustomBlockBooleanFieldSchema,
    CustomBlockChoiceFieldSchema,
    CustomBlockLinkFieldSchema,
    CustomBlockImageFieldSchema,
    CustomBlockDocumentFieldSchema,
    CustomBlockGroupFieldSchema,
    CustomBlockListFieldSchema,
  ]),
) as unknown as z.ZodType<CustomBlockField>;

export const CustomBlockGroupFieldSchema = z.looseObject({
  ...CommonFieldShape,
  kind: z.literal("group"),
  fields: z.array(CustomBlockFieldSchema).min(1),
});

const ListItemSchema = z.looseObject({
  kind: z.literal("group"),
  fields: z.array(CustomBlockFieldSchema).min(1),
});

export const CustomBlockListFieldSchema = z
  .looseObject({
    ...CommonFieldShape,
    kind: z.literal("list"),
    item: ListItemSchema,
    itemLabel: LocalizedTextSchema.optional(),
    minItems: z.number().int().nonnegative().optional(),
    maxItems: z.number().int().positive().optional(),
  })
  .refine((f) => f.minItems === undefined || f.maxItems === undefined || f.minItems <= f.maxItems, {
    message: "minItems must not be greater than maxItems",
    path: ["maxItems"],
  });

const BuilderCompatSchema = z.looseObject({
  formatVersion: z.literal(CUSTOM_BLOCK_DECLARATION_FORMAT_VERSION),
});

/**
 * The whole of `block.json`.
 *
 * `type` is permanent and keys saved data; `label` is what authors see and
 * may be renamed freely. `version` is the Block *data* format — the number
 * that lands in every envelope of this type — and is deliberately separate
 * from the package's own semver, so a visual fix never rewrites content
 * (issue-106 plan, "separate versions").
 */
export const CustomBlockDeclarationSchema = z
  .looseObject({
    formatVersion: z.literal(CUSTOM_BLOCK_DECLARATION_FORMAT_VERSION),
    type: z
      .string()
      .min(1)
      .regex(
        CUSTOM_BLOCK_TYPE_RE,
        "must be a namespaced type id such as 'org.example/partners' (namespace, slash, name)",
      ),
    version: z.number().int().positive(),
    label: LocalizedTextSchema,
    description: LocalizedTextSchema.optional(),
    builder: BuilderCompatSchema.optional(),
    fields: z.array(CustomBlockFieldSchema).min(1),
  })
  .superRefine((decl, ctx) => {
    let count = 0;
    const walk = (
      fields: readonly CustomBlockField[],
      path: (string | number)[],
      depth: number,
    ) => {
      const seen = new Set<string>();
      fields.forEach((field, index) => {
        count += 1;
        if (seen.has(field.name)) {
          ctx.addIssue({
            code: "custom",
            path: [...path, index, "name"],
            message: `field name "${field.name}" is declared twice in the same group`,
          });
        }
        seen.add(field.name);
        if (field.kind === "group" || field.kind === "list") {
          if (depth + 1 > CUSTOM_BLOCK_MAX_DEPTH) {
            ctx.addIssue({
              code: "custom",
              path: [...path, index],
              message: `groups and lists nest deeper than ${CUSTOM_BLOCK_MAX_DEPTH} levels`,
            });
            return;
          }
          const inner = field.kind === "group" ? field.fields : field.item.fields;
          walk(inner, [...path, index, field.kind === "group" ? "fields" : "item"], depth + 1);
        }
      });
    };
    walk(decl.fields, ["fields"], 1);
    if (count > CUSTOM_BLOCK_MAX_FIELDS) {
      ctx.addIssue({
        code: "custom",
        path: ["fields"],
        message: `declares ${count} fields; the limit is ${CUSTOM_BLOCK_MAX_FIELDS}`,
      });
    }
  });

export type CustomBlockDeclaration = z.infer<typeof CustomBlockDeclarationSchema>;

/** Why a `block.json` was refused. Stable codes; developer-facing messages. */
export type CustomBlockDeclarationErrorCode =
  /** `formatVersion` (or `builder.formatVersion`) names a format this builder does not implement. */
  | "format-version-unsupported"
  /** A field declares a kind outside the supported vocabulary. */
  | "unsupported-field-kind"
  /** Anything else the schema refuses. */
  | "invalid";

export type CustomBlockDeclarationParseResult =
  | { readonly ok: true; readonly declaration: CustomBlockDeclaration }
  | {
      readonly ok: false;
      readonly code: CustomBlockDeclarationErrorCode;
      /** Developer-facing, names the field or path. */
      readonly message: string;
      readonly at: string | undefined;
    };

/**
 * Find the first field whose `kind` is not in the vocabulary, before the
 * schema runs. A discriminated union reports an unknown discriminator as a
 * generic "invalid input", and the plan asks for the opposite: a message a
 * developer can act on, naming the field and what *is* supported.
 */
function findUnsupportedKind(
  fields: unknown,
  path: string,
): { readonly at: string; readonly kind: string } | undefined {
  if (!Array.isArray(fields)) return undefined;
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index] as {
      kind?: unknown;
      name?: unknown;
      fields?: unknown;
      item?: unknown;
    } | null;
    if (field === null || typeof field !== "object") continue;
    const name = typeof field.name === "string" ? field.name : String(index);
    const at = `${path}.${name}`;
    if (typeof field.kind !== "string" || !CUSTOM_BLOCK_FIELD_KINDS.includes(field.kind as never)) {
      return { at, kind: typeof field.kind === "string" ? field.kind : String(field.kind) };
    }
    if (field.kind === "group") {
      const inner = findUnsupportedKind(field.fields, at);
      if (inner !== undefined) return inner;
    }
    if (field.kind === "list") {
      const item = field.item as { fields?: unknown } | null;
      const inner = findUnsupportedKind(item?.fields, at);
      if (inner !== undefined) return inner;
    }
  }
  return undefined;
}

/**
 * Parse and validate a `block.json` document.
 *
 * Order matters. The format version is checked first so a package from a
 * newer builder gets "update the builder" rather than a wall of field errors;
 * unsupported kinds are checked next so the developer hears "kind 'color' is
 * not supported, use one of …" rather than "invalid discriminator".
 */
export function parseCustomBlockDeclaration(raw: unknown): CustomBlockDeclarationParseResult {
  const record = raw !== null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const declared = record["formatVersion"];
  const builderDeclared = (record["builder"] as { formatVersion?: unknown } | undefined)
    ?.formatVersion;
  for (const [at, value] of [
    ["formatVersion", declared],
    ["builder.formatVersion", builderDeclared],
  ] as const) {
    if (typeof value === "number" && value !== CUSTOM_BLOCK_DECLARATION_FORMAT_VERSION) {
      return {
        ok: false,
        code: "format-version-unsupported",
        message:
          `This Custom Block declaration uses format version ${value}, but this builder supports ` +
          `version ${CUSTOM_BLOCK_DECLARATION_FORMAT_VERSION}. Update the builder to use it.`,
        at,
      };
    }
  }

  const unsupported = findUnsupportedKind(record["fields"], "fields");
  if (unsupported !== undefined) {
    return {
      ok: false,
      code: "unsupported-field-kind",
      message:
        `Field "${unsupported.at}" declares kind "${unsupported.kind}", which this builder does not support. ` +
        `Supported kinds: ${CUSTOM_BLOCK_FIELD_KINDS.join(", ")}.`,
      at: unsupported.at,
    };
  }

  const result = CustomBlockDeclarationSchema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    const at = first === undefined ? undefined : first.path.join(".");
    return {
      ok: false,
      code: "invalid",
      message: first === undefined ? "invalid declaration" : `${at || "(root)"}: ${first.message}`,
      at,
    };
  }
  return { ok: true, declaration: result.data };
}

/** Walk every field of a declaration depth-first, with its data path (`[]` for list entries). */
export function walkCustomBlockFields(
  fields: readonly CustomBlockField[],
  visit: (field: CustomBlockField, path: readonly (string | "[]")[]) => void,
  base: readonly (string | "[]")[] = [],
): void {
  for (const field of fields) {
    const path = [...base, field.name];
    visit(field, path);
    if (field.kind === "group") walkCustomBlockFields(field.fields, visit, path);
    if (field.kind === "list") walkCustomBlockFields(field.item.fields, visit, [...path, "[]"]);
  }
}
