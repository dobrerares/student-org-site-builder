import type { ZodType } from "zod";
import {
  ActivityImageRefSchema,
  AssetRefSchema,
  CtaBannerAssetRefSchema,
  DocumentAssetRefSchema,
  PersonPhotoSchema,
} from "@sosb/schema";

/** Shared schema-identity map for AssetRef / document custom widgets (ADR 0043). */
export const MEDIA_PICKER_RENDERERS: ReadonlyMap<ZodType, string> = new Map<ZodType, string>([
  [AssetRefSchema, "asset-picker"],
  [CtaBannerAssetRefSchema, "asset-picker"],
  [PersonPhotoSchema, "asset-picker"],
  [ActivityImageRefSchema, "asset-picker"],
  [DocumentAssetRefSchema, "document-picker"],
]);
