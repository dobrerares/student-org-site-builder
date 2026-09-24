export {
  CUSTOM_BLOCK_DECLARATION_FORMAT_VERSION,
  CUSTOM_BLOCK_FIELD_KINDS,
  CUSTOM_BLOCK_FIELD_NAME_RE,
  CUSTOM_BLOCK_MAX_DEPTH,
  CUSTOM_BLOCK_MAX_FIELDS,
  CUSTOM_BLOCK_TYPE_RE,
  CustomBlockDeclarationSchema,
  CustomBlockFieldSchema,
  LocalizedTextSchema,
  isCustomBlockType,
  localizedText,
  parseCustomBlockDeclaration,
  walkCustomBlockFields,
} from "./declaration.js";
export type {
  CustomBlockDeclaration,
  CustomBlockDeclarationErrorCode,
  CustomBlockDeclarationParseResult,
  CustomBlockField,
  CustomBlockFieldKind,
  CustomBlockGroupField,
  CustomBlockListField,
  LocalizedText,
} from "./declaration.js";
export {
  EMPTY_CUSTOM_BLOCK_REGISTRY,
  buildCustomBlockRegistry,
  customBlockAvailabilityFor,
} from "./registry.js";
export type {
  CustomBlockAvailability,
  CustomBlockAvailable,
  CustomBlockFailedPackageSource,
  CustomBlockPackageSource,
  CustomBlockRegistry,
  CustomBlockUnavailable,
  CustomBlockUnavailableReason,
} from "./registry.js";
export {
  customBlockFieldAt,
  defaultCustomBlockData,
  defaultCustomBlockGroup,
  defaultCustomBlockListEntry,
} from "./defaults.js";
export {
  checkCustomBlockData,
  customBlockFieldHasShape,
  customBlockFieldIsEmpty,
} from "./check-data.js";
export type { CustomBlockCheckContext } from "./check-data.js";
export {
  adaptCustomBlockData,
  adaptSiteToDeclarations,
  previewCustomBlockValue,
  sameCustomBlockData,
} from "./adapt.js";
export type {
  AdaptedCustomBlockData,
  AdaptedSite,
  CustomBlockValuePreview,
  RemovedCustomBlockContent,
} from "./adapt.js";
