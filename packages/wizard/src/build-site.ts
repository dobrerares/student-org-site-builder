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

import { HERO_BLOCK_VERSION, SITE_SCHEMA_VERSION, type Site } from "@sosb/schema";
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

  const homePage = {
    slug: defaultLanguage === "en" ? DEFAULT_HOME_SLUG_EN : DEFAULT_HOME_SLUG_RO,
    lang: defaultLanguage,
    navLabel: defaultLanguage === "en" ? DEFAULT_HOME_NAV_LABEL_EN : DEFAULT_HOME_NAV_LABEL_RO,
    navOrder: 0,
    showInNav: true,
    blocks: [
      {
        id: "blk_wizard_hero",
        type: "hero",
        version: HERO_BLOCK_VERSION,
        data: heroSubtitle ? { title: heroTitle, subtitle: heroSubtitle } : { title: heroTitle },
      },
    ],
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
