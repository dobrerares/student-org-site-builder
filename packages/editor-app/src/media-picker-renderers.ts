import type { ZodType } from "zod";
import {
  ActivityImageRefSchema,
  AssetRefSchema,
  CtaBannerAssetRefSchema,
  DocumentAssetRefSchema,
  PersonPhotoSchema,
  RichTextDocumentSchema,
} from "@sosb/schema";

/**
 * Schema-identity map for editor-owned field widgets (ADR 0043).
 *
 * The key is a schema *instance*, matched by reference equality, not by
 * shape. That is why `@sosb/schema` exports one canonical `AssetRefSchema`
 * and every image-bearing Block imports it rather than redeclaring the same
 * fields: a structurally identical copy would silently fall through to the
 * generated object form.
 *
 * The map is module-scope so the references stay stable across renders.
 *
 * `RichTextDocumentSchema` → `"rich-text"` is what makes ADR 0048's
 * structured document open the Tiptap editor instead of a generated form
 * full of `version` and `content` fields. It is a schema-identity entry for
 * the same reason the asset pickers are: the document type is recognisable
 * on sight, wherever it appears, with no per-Block path metadata to keep in
 * sync.
 */
export const SCHEMA_FIELD_RENDERERS: ReadonlyMap<ZodType, string> = new Map<ZodType, string>([
  [AssetRefSchema, "asset-picker"],
  [CtaBannerAssetRefSchema, "asset-picker"],
  [PersonPhotoSchema, "asset-picker"],
  [ActivityImageRefSchema, "asset-picker"],
  [DocumentAssetRefSchema, "document-picker"],
  [RichTextDocumentSchema, "rich-text"],
]);

/**
 * Former name, kept as an alias.
 *
 * The map outgrew "media picker" when rich text joined it. Renaming the
 * export and leaving this behind costs one line and keeps the change from
 * rippling into call sites that have nothing to do with rich text.
 */
export const MEDIA_PICKER_RENDERERS = SCHEMA_FIELD_RENDERERS;
