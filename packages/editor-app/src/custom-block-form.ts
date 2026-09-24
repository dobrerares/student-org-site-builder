/**
 * From a Custom Block declaration to the form the builder generates
 * (ADR 0055; ADR 0046: "the builder provides the editing forms").
 *
 * Nothing new is rendered here. A declaration is turned into a Zod schema the
 * existing `BlockForm` walks, plus the path-keyed overrides that label,
 * explain and route each field — so a Custom Block's form is made of exactly
 * the controls a built-in Block's form is made of: the same text boxes, the
 * same Asset and Document pickers (schema-identity dispatch on the canonical
 * `AssetRefSchema` / `DocumentAssetRefSchema`), the same Rich-text editor
 * (`RichTextDocumentSchema`), the same list controls. Two renderer names are
 * new — `link-target` for a Link target and `image-with-description` for an
 * image whose screen-reader description is edited beside it — and both are
 * arms of `BlockForm`, not extension code (ADR 0044).
 *
 * Editing copy — labels, help, option labels, the name of a list entry — is
 * resolved for the editor's locale with fallback to the declaration's default
 * (issue-106 plan, "translated editing labels").
 */

import { z, type ZodType } from "zod";
import {
  AssetRefSchema,
  DocumentAssetRefSchema,
  RichTextDocumentSchema,
  RichTextLinkTargetSchema,
  defaultCustomBlockListEntry,
  localizedText,
  walkCustomBlockFields,
  type CustomBlockDeclaration,
  type CustomBlockField,
} from "@sosb/schema";

import type { FieldOverride } from "./field-metadata.js";

/**
 * The image shape, as a *distinct* schema instance. Schema-identity dispatch
 * (ADR 0043) wins over path-keyed dispatch, and the canonical `AssetRefSchema`
 * is registered to the plain Asset picker; a Custom Block image wants the
 * picker *with* its description control, which the path override below
 * selects — so the field must not be the canonical instance.
 */
const CustomBlockImageSchema = z.looseObject(AssetRefSchema.shape);

function schemaForField(field: CustomBlockField): ZodType {
  switch (field.kind) {
    case "text":
    case "choice":
      // A choice is a string rather than an enum so a saved value the
      // options no longer contain is *shown* (as a warning) rather than
      // silently dropped by the form. The select lists the declared options.
      return z.string();
    case "richText":
      return RichTextDocumentSchema;
    case "number":
      return z.number();
    case "boolean":
      return z.boolean();
    case "link":
      return RichTextLinkTargetSchema;
    case "image":
      return CustomBlockImageSchema;
    case "document":
      return DocumentAssetRefSchema;
    case "group":
      return schemaForGroup(field.fields);
    case "list":
      return z.array(schemaForGroup(field.item.fields));
  }
}

function schemaForGroup(fields: readonly CustomBlockField[]): ZodType {
  const shape: Record<string, ZodType> = {};
  for (const field of fields) {
    // Every field is optional to the form: authors save unfinished work, and
    // "required" is a validation warning, not a gate (issue-106 plan).
    shape[field.name] = schemaForField(field).optional();
  }
  return z.looseObject(shape);
}

/** The data schema `BlockForm` walks for this type. */
export function customBlockSchemaFor(declaration: CustomBlockDeclaration): ZodType {
  return schemaForGroup(declaration.fields);
}

/**
 * The path-keyed overrides for this type in one locale: labels and help for
 * every field, option labels for choices, entry labels for lists, and the
 * renderer names for links and images.
 */
export function customBlockOverridesFor(
  declaration: CustomBlockDeclaration,
  locale: string,
): FieldOverride[] {
  const overrides: FieldOverride[] = [];
  walkCustomBlockFields(declaration.fields, (field, path) => {
    const override: {
      path: string;
      label: string;
      hint?: string;
      renderer?: string;
      options?: readonly string[];
      optionLabels?: Record<string, string>;
      itemLabel?: string;
    } = { path: path.join("."), label: localizedText(field.label, locale) };
    const help = localizedText(field.help, locale);
    if (help.length > 0) override.hint = help;
    if (field.kind === "choice") {
      override.renderer = "choice";
      override.options = field.options.map((option) => option.value);
      override.optionLabels = Object.fromEntries(
        field.options.map((option) => [option.value, localizedText(option.label, locale)]),
      );
    }
    if (field.kind === "link") override.renderer = "link-target";
    if (field.kind === "image") override.renderer = "image-with-description";
    if (field.kind === "list") {
      const itemLabel = localizedText(field.itemLabel, locale);
      if (itemLabel.length > 0) override.itemLabel = itemLabel;
    }
    overrides.push(override);
  });
  return overrides;
}

/** The `newItem` factory for this type's lists: empty entries, declared defaults only. */
export function customBlockNewItemFor(
  declaration: CustomBlockDeclaration,
): (arrayPath: readonly (string | number)[]) => unknown {
  return (arrayPath) => defaultCustomBlockListEntry(declaration, arrayPath);
}
