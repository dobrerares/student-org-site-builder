import { describe, expect, test } from "vitest";
import { validate } from "@sosb/schema";

import { createBlankSite } from "../src/blank-site.js";

/**
 * AC: "Blank path creates a new site with a single page containing one hero
 * block."
 *
 * The factory produces a fully-typed `Site` that:
 *   - Has exactly one page.
 *   - That page has exactly one block.
 *   - That block is a hero block (type === "hero").
 *   - The site is `validate()`-clean (no validation errors).
 */
describe("createBlankSite", () => {
  test("produces a site that passes schema validation", () => {
    const site = createBlankSite();
    const result = validate(site);
    if (!result.ok) {
      // Surface the violations for easier debugging when this trips.
      throw new Error(
        "blank site failed validate(): " +
          JSON.stringify(result.errors, null, 2),
      );
    }
    expect(result.ok).toBe(true);
  });

  test("produces a site with exactly one page", () => {
    const site = createBlankSite();
    expect(site.pages).toHaveLength(1);
  });

  test("the single page has exactly one hero block", () => {
    const site = createBlankSite();
    const page = site.pages[0];
    expect(page).toBeDefined();
    expect(page!.blocks).toHaveLength(1);
    const block = page!.blocks[0];
    expect(block).toBeDefined();
    expect(block!.type).toBe("hero");
    expect(block!.version).toBe(1);
  });

  test("two calls produce structurally-equal sites with distinct identities", () => {
    const a = createBlankSite();
    const b = createBlankSite();
    // Equal in shape so tests stay deterministic.
    expect(a).toEqual(b);
    // But not the same object — each call returns a fresh draft so callers
    // can mutate without aliasing.
    expect(a).not.toBe(b);
    expect(a.pages).not.toBe(b.pages);
  });
});
