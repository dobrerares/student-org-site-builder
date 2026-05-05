// @vitest-environment jsdom
import { describe, expect, test, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/preact";
import type { Site } from "@sosb/schema";
import { PagesList } from "../src/pages-list.js";

/**
 * Editor multi-language affordances (#24):
 *
 * - The pages list groups pages by language with a heading per language.
 * - Each page row shows a "missing translation" indicator listing the
 *   languages that don't have a counterpart yet.
 * - An "Add language version" button per row opens an inline form to add a
 *   counterpart in a missing language.
 * - For single-language sites, none of the above is rendered (parity with
 *   #23 single-language behavior).
 */

function makeBilingualSite(): Site {
  return {
    schemaVersion: 1,
    org: { name: "Bilingual Org" },
    theme: { id: "stub" },
    defaultLanguage: "ro",
    languages: ["ro", "en"],
    pages: [
      {
        slug: "acasa",
        lang: "ro",
        navLabel: "Acasă",
        navOrder: 0,
        showInNav: true,
        blocks: [{ id: "blk_home_ro", type: "hero", version: 1, data: { title: "Acasă" } }],
        localizedAs: { en: "home" },
      },
      {
        slug: "despre",
        lang: "ro",
        navLabel: "Despre",
        navOrder: 1,
        showInNav: true,
        blocks: [{ id: "blk_about_ro", type: "hero", version: 1, data: { title: "Despre" } }],
      },
      {
        slug: "home",
        lang: "en",
        navLabel: "Home",
        navOrder: 0,
        showInNav: true,
        blocks: [{ id: "blk_home_en", type: "hero", version: 1, data: { title: "Home" } }],
        localizedAs: { ro: "acasa" },
      },
    ],
  } as unknown as Site;
}

function makeMonolingualSite(): Site {
  return {
    schemaVersion: 1,
    org: { name: "Mono Org" },
    theme: { id: "stub" },
    defaultLanguage: "ro",
    languages: ["ro"],
    pages: [
      {
        slug: "acasa",
        lang: "ro",
        navLabel: "Acasă",
        navOrder: 0,
        showInNav: true,
        blocks: [{ id: "blk_home", type: "hero", version: 1, data: { title: "Acasă" } }],
      },
    ],
  } as unknown as Site;
}

describe("PagesList - multi-language indicators", () => {
  afterEach(() => {
    cleanup();
  });

  function renderWith(site: Site, props: Partial<Record<string, unknown>> = {}) {
    const handlers = {
      onSelect: vi.fn(),
      onAdd: vi.fn(),
      onClone: vi.fn(),
      onDelete: vi.fn(),
      onMove: vi.fn(),
      onAddLanguageVersion: vi.fn(),
      ...props,
    };
    return {
      handlers,
      ...render(<PagesList site={site} activeIndex={0} {...handlers} />),
    };
  }

  test("groups pages by language with a heading per language", () => {
    const { container } = renderWith(makeBilingualSite());
    const groups = container.querySelectorAll('[data-testid="pages-list-language-group"]');
    expect(groups.length).toBe(2);
    expect(container.textContent).toContain("Română");
    expect(container.textContent).toContain("English");
  });

  test("marks pages with no counterpart in some language with a missing-translation indicator", () => {
    const { container } = renderWith(makeBilingualSite());
    // The "despre" page (idx 1) lacks an EN counterpart.
    const despreRow = container.querySelector<HTMLElement>(
      '[data-testid="pages-list-item"][data-index="1"]',
    );
    expect(despreRow).not.toBeNull();
    const indicator = despreRow!.querySelector('[data-testid="missing-translation-indicator"]');
    expect(indicator).not.toBeNull();
    expect(indicator!.textContent).toContain("English");
  });

  test("does not show the missing-translation indicator on rows with all counterparts", () => {
    const { container } = renderWith(makeBilingualSite());
    const acasaRow = container.querySelector<HTMLElement>(
      '[data-testid="pages-list-item"][data-index="0"]',
    );
    const indicator = acasaRow!.querySelector('[data-testid="missing-translation-indicator"]');
    expect(indicator).toBeNull();
  });

  test("renders an Add language version button per missing language on each row", () => {
    const { container } = renderWith(makeBilingualSite());
    const despreRow = container.querySelector<HTMLElement>(
      '[data-testid="pages-list-item"][data-index="1"]',
    );
    const addLangBtn = despreRow!.querySelector<HTMLButtonElement>(
      '[data-action="add-language-version"][data-target-lang="en"]',
    );
    expect(addLangBtn).not.toBeNull();
  });

  test("clicking Add language version calls onAddLanguageVersion with index + lang", () => {
    const onAddLanguageVersion = vi.fn();
    const { container } = renderWith(makeBilingualSite(), { onAddLanguageVersion });
    const despreRow = container.querySelector<HTMLElement>(
      '[data-testid="pages-list-item"][data-index="1"]',
    );
    const addLangBtn = despreRow!.querySelector<HTMLButtonElement>(
      '[data-action="add-language-version"][data-target-lang="en"]',
    );
    fireEvent.click(addLangBtn!);
    expect(onAddLanguageVersion).toHaveBeenCalledWith(1, "en");
  });

  test("monolingual site: no language group headings, no missing-translation indicator", () => {
    const { container } = renderWith(makeMonolingualSite());
    expect(
      container.querySelectorAll('[data-testid="pages-list-language-group"]').length,
    ).toBe(0);
    expect(
      container.querySelectorAll('[data-testid="missing-translation-indicator"]').length,
    ).toBe(0);
    expect(
      container.querySelectorAll('[data-action="add-language-version"]').length,
    ).toBe(0);
  });
});
