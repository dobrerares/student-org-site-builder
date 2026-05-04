import { describe, expect, test } from "vitest";
import historipol from "./fixtures/historipol.json" with { type: "json" };
import type { HeroBlock, Page, Site, ValidationIssue, ValidationResult } from "../src/index.js";
import { parseSite, validate } from "../src/index.js";

describe("derived TypeScript types", () => {
  test("Site type is inferred from the runtime schema, not hand-written", () => {
    const site: Site = parseSite(historipol);
    // If the type were drifting from the schema, accessing fields like these
    // would either be `never` or fail to compile. The runtime read also acts
    // as a sanity check that the inference reaches into nested fields.
    expect(site.org.name.length).toBeGreaterThan(0);
    expect(site.pages[0]!.slug.length).toBeGreaterThan(0);
  });

  test("Page type exposes the same shape as the schema", () => {
    const site = parseSite(historipol);
    const page: Page = site.pages[0]!;
    expect(typeof page.lang).toBe("string");
    expect(typeof page.slug).toBe("string");
    expect(typeof page.showInNav).toBe("boolean");
  });

  test("HeroBlock type is exported", () => {
    const block: HeroBlock = {
      id: "blk_a",
      type: "hero",
      version: 2,
      data: {
        title: "Hello",
      },
    };
    expect(block.type).toBe("hero");
  });

  test("ValidationResult and ValidationIssue types are exported", () => {
    const result: ValidationResult = validate(historipol);
    const collect: ValidationIssue[] = [...result.errors, ...result.warnings, ...result.info];
    expect(Array.isArray(collect)).toBe(true);
  });
});
