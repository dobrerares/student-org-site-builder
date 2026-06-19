import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import historipol from "./fixtures/team-grid-historipol.json" with { type: "json" };
import flat from "./fixtures/team-grid-flat.json" with { type: "json" };
import { renderSite } from "../src/index.js";

const grouped = historipol as unknown as Site;
const ungrouped = flat as unknown as Site;

describe("renderSite — teamGrid block (structural)", () => {
  test("renders a <section> with the teamGrid data-block attribute", () => {
    const html = renderSite(ungrouped, "stub");
    expect(html).toMatch(/<section[^>]*data-block="teamGrid"/);
  });

  test("renders the title and intro when present", () => {
    const html = renderSite(grouped, "stub");
    expect(html).toContain("Echipa noastră");
    expect(html).toContain("Cei care fac HISTORIPOL să funcționeze.");
  });

  test("omits the intro paragraph when intro is unset", () => {
    const html = renderSite(ungrouped, "stub");
    expect(html).not.toMatch(/<p[^>]*class="team-grid__intro"/);
  });

  test("renders every person's name and role", () => {
    const html = renderSite(grouped, "stub");
    // Spot-check several entries from the HISTORIPOL fixture (9 people).
    expect(html).toContain("Ana Popescu");
    expect(html).toContain("Președinte");
    expect(html).toContain("Mihai Ionescu");
    expect(html).toContain("Vicepreședinte");
    expect(html).toContain("Cristina Ene");
    expect(html).toContain("Trezorier");
  });

  test("renders all 9 people in the HISTORIPOL fixture", () => {
    const html = renderSite(grouped, "stub");
    const personMatches = html.match(/data-person-card/g) ?? [];
    expect(personMatches.length).toBe(9);
  });
});

describe("renderSite — teamGrid grouping", () => {
  test("renders one group header per distinct group value when groupBy is set", () => {
    const html = renderSite(grouped, "stub");
    // The HISTORIPOL fixture spreads 9 people across 4 departments:
    // Conducere (2), Comunicare (2), Evenimente (3), Finanțe (2).
    expect(html).toContain("Conducere");
    expect(html).toContain("Comunicare");
    expect(html).toContain("Evenimente");
    expect(html).toContain("Finanțe");
    const groupMatches = html.match(/data-team-group/g) ?? [];
    expect(groupMatches.length).toBe(4);
  });

  test("does not emit any group header when groupBy is unset", () => {
    const html = renderSite(ungrouped, "stub");
    expect(html).not.toMatch(/data-team-group/);
  });

  test("preserves first-seen group order from the people array", () => {
    const html = renderSite(grouped, "stub");
    const conducereIdx = html.indexOf(">Conducere<");
    const comunicareIdx = html.indexOf(">Comunicare<");
    const evenimenteIdx = html.indexOf(">Evenimente<");
    const finanteIdx = html.indexOf(">Finanțe<");
    expect(conducereIdx).toBeGreaterThan(-1);
    expect(comunicareIdx).toBeGreaterThan(conducereIdx);
    expect(evenimenteIdx).toBeGreaterThan(comunicareIdx);
    expect(finanteIdx).toBeGreaterThan(evenimenteIdx);
  });
});

describe("renderSite — teamGrid photo and avatar fallback", () => {
  test("renders an <img> with the asset path and alt text when a person has a photo", () => {
    const html = renderSite(grouped, "stub");
    expect(html).toContain('src="assets/a1b2c3d4e5f60718.jpg"');
    expect(html).toContain('alt="Portret Ana Popescu"');
  });

  test("renders an initial-letter avatar fallback when a person has no photo", () => {
    const html = renderSite(grouped, "stub");
    // Mihai Ionescu (no photo in fixture) -> initial letter "M".
    expect(html).toMatch(/<span[^>]*class="team-person__avatar"[^>]*>M<\/span>/);
    // Radu Stan -> "R".
    expect(html).toMatch(/<span[^>]*class="team-person__avatar"[^>]*>R<\/span>/);
  });

  test("avatar fallback marks itself aria-hidden so screen-readers don't double-announce the name", () => {
    const html = renderSite(grouped, "stub");
    expect(html).toMatch(/<span[^>]*class="team-person__avatar"[^>]*aria-hidden="true"/);
  });

  test("photo <img> uses loading=lazy for below-the-fold performance", () => {
    const html = renderSite(grouped, "stub");
    // At least one of the team photos must be lazy-loaded.
    expect(html).toMatch(/<img[^>]*src="assets\/[a-f0-9]+\.jpg"[^>]*loading="lazy"/);
  });
});

describe("renderSite — teamGrid social links", () => {
  test("renders an <a> per social link with the platform as a class hook for icons", () => {
    const html = renderSite(grouped, "stub");
    expect(html).toMatch(
      /<a[^>]*class="team-person__social team-person__social--linkedin"[^>]*href="https:\/\/linkedin\.com\/in\/ana"/,
    );
    expect(html).toMatch(
      /<a[^>]*class="team-person__social team-person__social--email"[^>]*href="mailto:ana@historipol\.ro"/,
    );
    expect(html).toMatch(
      /<a[^>]*class="team-person__social team-person__social--instagram"[^>]*href="https:\/\/instagram\.com\/mihai"/,
    );
  });

  test("renders a visually-hidden label per social link for accessibility", () => {
    const html = renderSite(grouped, "stub");
    // Each social anchor wraps a span describing the platform for SR users.
    expect(html).toMatch(/<span class="visually-hidden">linkedin<\/span>/);
    expect(html).toMatch(/<span class="visually-hidden">email<\/span>/);
  });

  test("does not emit a socials list when a person has no socials", () => {
    const html = renderSite(grouped, "stub");
    // Count only <ul class="team-person__socials"> opening tags. People with
    // socials in the HISTORIPOL fixture: Ana, Mihai, George => 3.
    const matches = html.match(/<ul class="team-person__socials"/g) ?? [];
    expect(matches.length).toBe(3);
  });
});

describe("renderSite — teamGrid responsive columns", () => {
  test("encodes the column count as an inline custom property on the grid root", () => {
    const html = renderSite(ungrouped, "stub");
    // ungrouped fixture uses columns: 2 -> the renderer announces it via a
    // CSS custom property so the theme's media-query breakpoints can adapt.
    expect(html).toMatch(/--team-grid-columns:\s*2/);
  });

  test("encodes columns: 3 for the HISTORIPOL fixture", () => {
    const html = renderSite(grouped, "stub");
    expect(html).toMatch(/--team-grid-columns:\s*3/);
  });

  test("emits a CSS rule using the column count via grid-template-columns", () => {
    const html = renderSite(grouped, "stub");
    // The stub theme contributes the responsive grid CSS that consumes the
    // --team-grid-columns custom property; the renderer must ship a rule
    // that maps the count into a CSS Grid layout.
    expect(html).toMatch(/grid-template-columns/);
  });

  test("emits a media-query that reduces the grid to 1 column on narrow screens", () => {
    const html = renderSite(grouped, "stub");
    expect(html).toMatch(/@media[^{]*max-width[^{]*{[^}]*team-grid[^}]*1fr/);
  });
});

describe("renderSite — teamGrid forward-compat", () => {
  test("tolerates an unknown extra field on a person (forward-compat)", () => {
    const withExtra = structuredClone(grouped);
    const block = withExtra.pages[0]!.blocks[0]!;
    const data = block.data as { people: Record<string, unknown>[] };
    data.people[0]!.futurePersonField = "ignored-ok";
    const html = renderSite(withExtra, "stub");
    // Must not throw, must still render the original name.
    expect(html).toContain("Ana Popescu");
    expect(html).not.toContain("ignored-ok");
  });

  test("tolerates an unknown social platform string by class-name slug", () => {
    const withExoticSocial = structuredClone(grouped);
    const block = withExoticSocial.pages[0]!.blocks[0]!;
    const data = block.data as {
      people: { socials?: { platform: string; url: string }[] }[];
    };
    data.people[0]!.socials = [{ platform: "mastodon", url: "https://example.social/@ana" }];
    const html = renderSite(withExoticSocial, "stub");
    expect(html).toContain("team-person__social--mastodon");
  });

  test("skips incomplete social rows instead of throwing during live preview", () => {
    const withIncompleteSocial = structuredClone(ungrouped);
    const block = withIncompleteSocial.pages[0]!.blocks[0]!;
    const data = block.data as {
      people: { socials?: unknown[] }[];
    };
    data.people[0]!.socials = [{}];

    const html = renderSite(withIncompleteSocial, "stub");
    expect(html).toContain("Ana Popescu");
    expect(html).not.toMatch(/<ul class="team-person__socials"/);
  });

  test("uses a generic link platform when a social URL has no platform", () => {
    const withUrlOnlySocial = structuredClone(ungrouped);
    const block = withUrlOnlySocial.pages[0]!.blocks[0]!;
    const data = block.data as {
      people: { socials?: unknown[] }[];
    };
    data.people[0]!.socials = [{ url: "/team" }];

    const html = renderSite(withUrlOnlySocial, "stub");
    expect(html).toContain('class="team-person__social team-person__social--link"');
    expect(html).toContain('href="/team"');
  });
});

describe("renderSite — teamGrid CSS hygiene", () => {
  test("teamGrid CSS uses var(--token) and never hardcodes hex/rgb outside :root", () => {
    const html = renderSite(grouped, "stub");
    const styleBlocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]!);
    const nonRootRules = styleBlocks.join("\n").replace(/:root\s*\{[^}]*\}/g, "");
    expect(nonRootRules).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(nonRootRules).not.toMatch(/\brgb\(/);
    expect(nonRootRules).not.toMatch(/\brgba\(/);
  });
});

describe("renderSite — teamGrid determinism", () => {
  test("produces byte-identical output across repeated calls", () => {
    const a = renderSite(grouped, "stub");
    const b = renderSite(grouped, "stub");
    const c = renderSite(grouped, "stub");
    expect(a).toBe(b);
    expect(b).toBe(c);
  });
});
