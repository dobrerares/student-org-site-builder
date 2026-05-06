import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import { validate } from "@sosb/schema";

import tiered from "./fixtures/issue-tiered-site.json" with { type: "json" };

const site = tiered as unknown as Site;

/**
 * Sanity check on the test fixture itself: it must produce a mix of
 * severities so the Site Health panel tests in this package can rely on
 * each tier being non-empty. If schema rules change in the future, this
 * test fails first and points to the fixture.
 */
describe("issue-tiered-site fixture", () => {
  test("produces at least one error and at least one warning", () => {
    const r = validate(site);
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  test("the fixture includes a duplicate-slug error", () => {
    const r = validate(site);
    const codes = r.errors.map((i) => i.code);
    expect(codes).toContain("site.page.slug.duplicate");
  });

  test("the fixture includes a missing-org-email warning", () => {
    const r = validate(site);
    const codes = r.warnings.map((i) => i.code);
    expect(codes).toContain("site.org.email.missing");
  });

  test("the fixture includes a hero-backgroundAlt warning", () => {
    const r = validate(site);
    const codes = r.warnings.map((i) => i.code);
    expect(codes).toContain("block.hero.backgroundAlt.missing");
  });
});
