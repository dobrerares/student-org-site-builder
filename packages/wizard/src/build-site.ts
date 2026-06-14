/**
 * Build a `Site` object from the wizard's captured `WizardData`.
 *
 * Per the AC: "Final confirm step previews the site, then 'Create' opens
 * it in the editor". The handoff is a `Site` object the editor can mount
 * directly — it must validate clean against `@sosb/schema`'s `validate()`.
 *
 * The mapping is conservative: required spine fields fall back to safe
 * defaults when the user skipped a step, and the home page always
 * receives a hero block (PRD §"Default 1 page on new sites").
 *
 * Tracking issue: #33.
 */

import {
  ACTIVITIES_LIST_BLOCK_VERSION,
  CONTACT_CARD_BLOCK_VERSION,
  HERO_BLOCK_VERSION,
  RICH_TEXT_BLOCK_VERSION,
  TEAM_GRID_BLOCK_VERSION,
  VALUE_LIST_BLOCK_VERSION,
  SITE_SCHEMA_VERSION,
  type BlockEnvelope,
  type Site,
} from "@sosb/schema";
import type { WizardData } from "./state-machine.js";

const DEFAULT_THEME_ID = "minimal";
const DEFAULT_LANGUAGE = "ro";

/**
 * Romanian-default home page slug. The editor's i18n layer (#34) replaces
 * this when the user picks a different default language; for now the
 * v1 wizard ships RO-default per the PRD.
 */
const DEFAULT_HOME_SLUG_RO = "acasa";
const DEFAULT_HOME_SLUG_EN = "home";
const DEFAULT_HOME_NAV_LABEL_RO = "Acasă";
const DEFAULT_HOME_NAV_LABEL_EN = "Home";
const MANDATORY_BLOCK_ORDER = [
  "hero",
  "richText",
  "valueList",
  "activitiesList",
  "teamGrid",
  "contactCard",
] as const;

type WizardStarterBlockType = (typeof MANDATORY_BLOCK_ORDER)[number];

/**
 * Pure mapper from wizard data to a `Site`. Each call returns a fresh
 * object literal (no shared state). The output validates clean against
 * `validate()` — see `packages/wizard/test/build-site.test.ts`.
 */
export function buildSiteFromWizard(data: WizardData): Site {
  const orgName = data.basics?.name?.trim() || "My Organization";
  const tagline = data.basics?.tagline;
  const foundedYear = data.basics?.foundedYear;

  const themeId = data.identity?.themeId?.trim() || DEFAULT_THEME_ID;

  const languagesMode = data.languages?.mode ?? "single";
  const defaultLanguage = data.languages?.defaultLanguage ?? DEFAULT_LANGUAGE;
  const secondaryLanguage = data.languages?.secondaryLanguage;

  const languages =
    languagesMode === "bilingual" &&
    secondaryLanguage !== undefined &&
    secondaryLanguage !== defaultLanguage
      ? [defaultLanguage, secondaryLanguage]
      : [defaultLanguage];

  const heroTitle = data.content?.heroTitle?.trim() || tagline?.trim() || orgName;
  const heroSubtitle = data.content?.heroSubtitle?.trim();
  const selectedSections = selectedStarterSections(data);

  const homePage = {
    slug: defaultLanguage === "en" ? DEFAULT_HOME_SLUG_EN : DEFAULT_HOME_SLUG_RO,
    lang: defaultLanguage,
    navLabel: defaultLanguage === "en" ? DEFAULT_HOME_NAV_LABEL_EN : DEFAULT_HOME_NAV_LABEL_RO,
    navOrder: 0,
    showInNav: true,
    blocks: selectedSections.map((type) =>
      starterBlockFor(type, { orgName, heroTitle, heroSubtitle }),
    ),
  };

  return {
    schemaVersion: SITE_SCHEMA_VERSION,
    org: {
      name: orgName,
      ...(tagline ? { tagline } : {}),
      ...(foundedYear !== undefined ? { foundedYear } : {}),
    },
    theme: {
      id: themeId,
    },
    defaultLanguage,
    languages,
    pages: [homePage],
  };
}

function selectedStarterSections(data: WizardData): WizardStarterBlockType[] {
  const requested = data.sections?.mandatory;
  if (requested === undefined) return [...MANDATORY_BLOCK_ORDER];

  const allowed = new Set<string>(MANDATORY_BLOCK_ORDER);
  const selected = MANDATORY_BLOCK_ORDER.filter(
    (type) => requested.includes(type) && allowed.has(type),
  );
  return selected.length > 0 ? selected : ["hero"];
}

function starterBlockFor(
  type: WizardStarterBlockType,
  context: {
    readonly orgName: string;
    readonly heroTitle: string;
    readonly heroSubtitle: string | undefined;
  },
): BlockEnvelope {
  switch (type) {
    case "hero":
      return {
        id: "blk_wizard_hero",
        type,
        version: HERO_BLOCK_VERSION,
        data:
          context.heroSubtitle !== undefined
            ? { title: context.heroTitle, subtitle: context.heroSubtitle }
            : { title: context.heroTitle },
      };
    case "richText":
      return {
        id: "blk_wizard_about",
        type,
        version: RICH_TEXT_BLOCK_VERSION,
        data: {
          markdown: `## About ${context.orgName}\n\nWrite a short introduction for your organisation here.`,
        },
      };
    case "valueList":
      return {
        id: "blk_wizard_values",
        type,
        version: VALUE_LIST_BLOCK_VERSION,
        data: {
          title: "Our values",
          items: [{ label: "Value name", description: "Short description of this value." }],
          layout: "grid",
          columns: 3,
        },
      };
    case "activitiesList":
      return {
        id: "blk_wizard_activities",
        type,
        version: ACTIVITIES_LIST_BLOCK_VERSION,
        data: {
          title: "Activities",
          layout: "cards",
          items: [{ title: "New activity" }],
        },
      };
    case "teamGrid":
      return {
        id: "blk_wizard_team",
        type,
        version: TEAM_GRID_BLOCK_VERSION,
        data: {
          title: "Team",
          columns: 3,
          people: [{ name: "Member name", role: "Role" }],
        },
      };
    case "contactCard":
      return {
        id: "blk_wizard_contact",
        type,
        version: CONTACT_CARD_BLOCK_VERSION,
        data: {
          address: "Address line",
          email: "contact@example.org",
          phone: "+40 700 000 000",
        },
      };
  }
}
