import { HERO_BLOCK_VERSION, SITE_SCHEMA_VERSION, type Site } from "@sosb/schema";

export const BLANK_SITE: Site = {
  schemaVersion: SITE_SCHEMA_VERSION,
  org: {
    name: "Your organisation",
    tagline: "A short description of what you do.",
    email: "hello@example.org",
  },
  theme: {
    id: "modern",
    tokens: {
      colorPrimary: "#17202a",
      colorAccent: "#0f766e",
    },
  },
  defaultLanguage: "en",
  languages: ["en"],
  pages: [
    {
      slug: "home",
      lang: "en",
      navLabel: "Home",
      navOrder: 0,
      showInNav: true,
      blocks: [
        {
          id: "blk_home_hero",
          type: "hero",
          version: HERO_BLOCK_VERSION,
          data: {
            title: "Your organisation",
            subtitle: "A short description of what you do.",
          },
        },
      ],
    },
  ],
};
