/**
 * Curated template registry.
 *
 * The welcome screen's "Start from template" path (#32) reads this list to
 * present pickable starter sites. v1 ships exactly one curated template
 * (issue #34); additional templates land in their own follow-up issues.
 */
import {
  ASOCIATIA_STUDENTEASCA_DEMO,
  type TemplateDescriptor,
} from "./asociatia-studenteasca-demo/index.js";

export {
  ASOCIATIA_STUDENTEASCA_DEMO,
  ASOCIATIA_STUDENTEASCA_DEMO_ID,
  asociatiaStudenteascaDemoData,
  asociatiaStudenteascaDemoMetadata,
} from "./asociatia-studenteasca-demo/index.js";
export type {
  AssetCredits,
  AsociatiaStudenteascaDemoMetadata,
  ReplaceMarker,
  TemplateDescriptor,
} from "./asociatia-studenteasca-demo/index.js";

/**
 * Ordered list of all curated demo templates shipped with this build.
 * The welcome screen consumes this list directly.
 */
export const TEMPLATES: readonly TemplateDescriptor[] = [ASOCIATIA_STUDENTEASCA_DEMO];
