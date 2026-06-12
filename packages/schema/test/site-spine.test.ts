import { describe, expect, test } from "vitest";
import historipol from "./fixtures/historipol.json" with { type: "json" };
import { SITE_SCHEMA_VERSION, SiteSchema, parseSite, validate } from "../src/index.js";

describe("site spine schema", () => {
  test("validates the HISTORIPOL fixture", () => {
    const result = SiteSchema.safeParse(historipol);
    expect(result.success).toBe(true);
  });

  test("validate() reports ok=true for the HISTORIPOL fixture", () => {
    const result = validate(historipol);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  test("rejects sites missing the org name", () => {
    // structuredClone preserves the JSON shape without aliasing the imported module.
    const broken = structuredClone(historipol) as unknown as {
      org: { name: string };
    };
    broken.org.name = "";
    const result = SiteSchema.safeParse(broken);
    expect(result.success).toBe(false);
  });

  test("validate() returns errors with severity, code, message and path", () => {
    const broken = structuredClone(historipol) as unknown as {
      org: { name: string };
    };
    broken.org.name = "";
    const result = validate(broken);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    const issue = result.errors[0]!;
    expect(issue.severity).toBe("error");
    expect(typeof issue.code).toBe("string");
    expect(issue.code.length).toBeGreaterThan(0);
    expect(typeof issue.message).toBe("string");
    expect(Array.isArray(issue.path)).toBe(true);
    // The error must point at the empty org.name field, not somewhere else.
    expect(issue.path).toContain("org");
  });

  test("rejects pages whose lang is not in the languages list", () => {
    const broken = structuredClone(historipol) as unknown as {
      pages: { lang: string }[];
    };
    broken.pages[0]!.lang = "fr";
    const result = validate(broken);
    expect(result.ok).toBe(false);
    expect(result.errors.some((i) => i.path.includes("pages"))).toBe(true);
  });

  test("rejects duplicate slugs within the same language", () => {
    const broken = structuredClone(historipol) as unknown as {
      pages: { slug: string; lang: string }[];
    };
    // Force the second RO page to share the slug of the first RO page.
    broken.pages[2]!.slug = "acasa";
    const result = validate(broken);
    expect(result.ok).toBe(false);
    expect(result.errors.some((i) => i.code.includes("duplicate"))).toBe(true);
  });

  test("rejects malformed slugs with a clear error code", () => {
    const broken = structuredClone(historipol) as unknown as {
      pages: { slug: string }[];
    };
    broken.pages[0]!.slug = "Bad Slug!";
    const result = validate(broken);
    expect(result.ok).toBe(false);
    expect(result.errors.some((i) => i.code.startsWith("site.page.slug."))).toBe(true);
    // The path must point at pages[0].slug, not somewhere else.
    expect(
      result.errors.some((i) => i.path[0] === "pages" && i.path[1] === 0 && i.path[2] === "slug"),
    ).toBe(true);
  });

  test("rejects slugs containing slashes (no nested page hierarchy in v1)", () => {
    const broken = structuredClone(historipol) as unknown as {
      pages: { slug: string }[];
    };
    broken.pages[0]!.slug = "blog/post";
    const result = validate(broken);
    expect(result.ok).toBe(false);
    expect(result.errors.some((i) => i.code === "site.page.slug.containsSlash")).toBe(true);
  });

  test("parseSite returns typed data on success", () => {
    const site = parseSite(historipol);
    // The TS types are derived; this assertion lives at runtime to make the
    // contract tangible.
    expect(site.org.name).toBe("Asociația Studențească HISTORIPOL");
    expect(site.pages.length).toBe(3);
  });

  test("exports the v1 schema version constant", () => {
    expect(SITE_SCHEMA_VERSION).toBe(1);
  });

  test("validate() warns when org logo is set without logoAlt", () => {
    const broken = structuredClone(historipol) as {
      org: { logoAlt?: string };
    };
    delete broken.org.logoAlt;
    const result = validate(broken);
    expect(result.ok).toBe(true);
    const codes = result.warnings.map((w) => w.code);
    expect(codes).toContain("site.org.logoAlt.missing");
  });
});
