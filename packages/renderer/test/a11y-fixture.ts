/**
 * A11y regression-fixture generator.
 *
 * Issue #40 asks for a per-theme accessibility regression matrix. This module
 * is the matrix's cell-builder: given a `themeId` and a list of block types
 * to exercise, it returns a fully-populated `Site` whose:
 *
 *  - body carries every Romanian diacritic at least once,
 *  - hero subtitle holds long Romanian copy that exercises line-wrapping in
 *    every theme's hero variant,
 *  - pages are mirrored RO ⇄ EN with reciprocal `localizedAs` links so the
 *    multi-language switcher (per #24) is exercised against axe-core.
 *
 * The generator is deterministic — same input produces byte-identical JSON —
 * and is **not** coupled to any particular theme. Every theme that registers
 * itself in `KNOWN_THEME_IDS` (renderer index) gets exercised by the same
 * fixture content. This is the dynamic-matrix design recorded in ADR 0026.
 *
 * v1 ships only the hero block; the renderer's `renderBlock` switch silently
 * comments unknown block types out (see `page-shell.tsx`). When real block
 * components land (#9-#22), each block type added to `blocksPresent[]` lights
 * up automatically without changes here. Until then, requesting an unknown
 * block type results in a structurally-valid fixture that the renderer treats
 * as a no-op for that block — the axe pass still validates the surrounding
 * shell's a11y.
 */

import type { Site, BlockEnvelope } from "@sosb/schema";

/**
 * Romanian diacritic characters that the test corpus must cover, per the
 * issue contract. Includes both upper- and lower-case forms of the five
 * letters with diacritics in the modern Romanian alphabet:
 *  - Ă/ă (a-breve), Â/â (a-circumflex), Î/î (i-circumflex),
 *  - Ș/ș (s-comma) and Ț/ț (t-comma).
 *
 * Note: we use the comma-below forms (U+0218/U+021A and their lowercase
 * counterparts), not the cedilla forms — comma-below is the orthographically
 * correct Romanian sequence.
 */
export const ROMANIAN_DIACRITIC_CHARSET: readonly string[] = [
  "Ă",
  "ă",
  "Â",
  "â",
  "Î",
  "î",
  "Ș",
  "ș",
  "Ț",
  "ț",
] as const;

export interface A11yFixtureOptions {
  /**
   * Override the home-page slug. Defaults to `"acasa"`. Tests that need to
   * exercise multi-page routing (#23) override this; the v1 build pipeline
   * is single-page so the default value is fine for the a11y matrix today.
   */
  readonly homeSlug?: string;
}

/**
 * Long-form Romanian copy that covers every diacritic and is long enough to
 * force multi-line wrapping in every theme's hero variant. The string is
 * inlined as a single readonly constant so the fixture stays deterministic;
 * editing this string changes the fixture's identity which in turn changes
 * the dist HTML's identity — that drift is the point of the regression test.
 */
const LONG_RO_COPY: string =
  "Asociația studenților dezvoltă proiecte sociale, culturale și " +
  "educaționale în întreaga țară. În fiecare semestru organizăm sesiuni de " +
  "voluntariat, ateliere tematice și conferințe deschise comunității, cu " +
  "scopul de a sprijini implicarea civică și formarea profesională a " +
  "tinerilor. Îți mulțumim că ne ești alături în această misiune.";

const SHORT_RO_TAGLINE: string =
  "Învățăm împreună prin proiecte sociale, ateliere și acțiuni civice când este nevoie.";

const HOMEPAGE_TITLE_RO: string = "Bun venit la Asociația Studenților";
const HOMEPAGE_TITLE_EN: string = "Welcome to the Students' Association";
const HOMEPAGE_EYEBROW_RO: string = "Despre noi";
const HOMEPAGE_EYEBROW_EN: string = "About us";
const HOMEPAGE_NAV_LABEL_RO: string = "Acasă";
const HOMEPAGE_NAV_LABEL_EN: string = "Home";

const LONG_EN_COPY: string =
  "The students' association develops social, cultural and educational " +
  "projects across the country. Each semester we run volunteering sessions, " +
  "thematic workshops and conferences open to the broader community, with " +
  "the goal of supporting civic engagement and professional growth among " +
  "young people. Thank you for being part of this journey.";

/**
 * Build a hero block populated with diacritic and long-copy content for the
 * Romanian page. The block is keyed by id so reordering is non-ambiguous.
 *
 * Hero is the mandatory page-opener (per the PRD), so this builder always
 * runs even when `blocksPresent[]` is empty — see `generateA11yFixture`.
 */
function buildHeroRo(): BlockEnvelope {
  return {
    id: "blk_home_hero_ro",
    type: "hero",
    version: 1,
    data: {
      eyebrow: HOMEPAGE_EYEBROW_RO,
      title: HOMEPAGE_TITLE_RO,
      subtitle: LONG_RO_COPY,
      backgroundImage: {
        hash: "hero",
        path: "assets/hero.jpg",
        metadataPath: "assets/hero.metadata.json",
        mime: "image/jpeg",
        width: 1600,
        height: 1067,
        alt: "Studenți la ședință — Învățăm ÎMPREUNĂ pentru Țară (Ă, Â, Î, Ș, Ț)",
      },
      // Alt text covers diacritics that the title alone would miss; we
      // deliberately spell the uppercase forms (Ă/Â/Î/Ș/Ț) inline so the
      // test corpus exercises every codepoint in `ROMANIAN_DIACRITIC_CHARSET`.
      backgroundAlt: "Studenți la ședință — Învățăm ÎMPREUNĂ pentru Țară (Ă, Â, Î, Ș, Ț)",
    },
  };
}

function buildHeroEn(): BlockEnvelope {
  return {
    id: "blk_home_hero_en",
    type: "hero",
    version: 1,
    data: {
      eyebrow: HOMEPAGE_EYEBROW_EN,
      title: HOMEPAGE_TITLE_EN,
      subtitle: LONG_EN_COPY,
      backgroundImage: {
        hash: "hero",
        path: "assets/hero.jpg",
        metadataPath: "assets/hero.metadata.json",
        mime: "image/jpeg",
        width: 1600,
        height: 1067,
        alt: "Students at a community workshop",
      },
      backgroundAlt: "Students at a community workshop",
    },
  };
}

/**
 * Build an extra block envelope for any non-hero type the caller requests.
 *
 * v1 ships only the `hero` block component; unknown block types are
 * deliberately preserved by the schema's `looseObject` envelope and silently
 * commented out by the renderer (see `page-shell.tsx`'s `renderBlock`). That
 * means: requesting `["hero","team","faq"]` from an a11y test today yields
 * a Site that round-trips through schema validation, contains an HTML
 * comment per unknown type, and still axe-passes (HTML comments do not
 * affect a11y assertions). When the real components land, the matrix lights
 * up automatically without edits here.
 */
function buildExtraBlock(type: string, langSuffix: string): BlockEnvelope {
  return {
    id: `blk_${type}_${langSuffix}`,
    type,
    version: 1,
    // Per-block schemas land in #9-#22; until then the envelope is the only
    // contract. We carry a representative `data.heading` so future-blocks can
    // round-trip schema validation if they only assert presence.
    data: {
      heading: `${type} (${langSuffix})`,
    },
  };
}

/**
 * Generate a deterministic `Site` exercising the issue-#40 a11y test corpus.
 *
 * The returned object is a fully-validatable v1 Site (`schemaVersion: 1`)
 * with two pages — the Romanian home page and its English counterpart —
 * linked via reciprocal `localizedAs`. Both pages always include the
 * mandatory hero; additional block types in `blocksPresent` are appended to
 * each page in declaration order so the matrix exercises a deterministic
 * block sequence per theme.
 */
export function generateA11yFixture(
  themeId: string,
  blocksPresent: readonly string[],
  options: A11yFixtureOptions = {},
): Site {
  const homeSlug = options.homeSlug ?? "acasa";
  const enHomeSlug = "home";

  const extraTypes = blocksPresent.filter((t) => t !== "hero");

  const roBlocks: BlockEnvelope[] = [
    buildHeroRo(),
    ...extraTypes.map((t) => buildExtraBlock(t, "ro")),
  ];
  const enBlocks: BlockEnvelope[] = [
    buildHeroEn(),
    ...extraTypes.map((t) => buildExtraBlock(t, "en")),
  ];

  const site: Site = {
    schemaVersion: 1,
    org: {
      name: "Asociația Studenților Țări",
      tagline: SHORT_RO_TAGLINE,
      email: "contact@example.org",
    },
    theme: {
      id: themeId,
      tokens: {
        colorPrimary: "#1f3a5f",
        colorAccent: "#c08a3e",
      },
    },
    defaultLanguage: "ro",
    languages: ["ro", "en"],
    pages: [
      {
        slug: homeSlug,
        lang: "ro",
        navLabel: HOMEPAGE_NAV_LABEL_RO,
        navOrder: 0,
        showInNav: true,
        seo: {
          title: `${HOMEPAGE_TITLE_RO} — Acasă`,
          description: SHORT_RO_TAGLINE,
        },
        blocks: roBlocks,
        localizedAs: { en: enHomeSlug },
      },
      {
        slug: enHomeSlug,
        lang: "en",
        navLabel: HOMEPAGE_NAV_LABEL_EN,
        navOrder: 0,
        showInNav: true,
        seo: {
          title: `${HOMEPAGE_TITLE_EN} — Home`,
          description: "Learning together through social and civic projects.",
        },
        blocks: enBlocks,
        localizedAs: { ro: homeSlug },
      },
    ],
  };

  return site;
}
