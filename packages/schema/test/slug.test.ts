import { describe, expect, test } from "vitest";
import { checkSlug, isValidSlug } from "../src/slug.js";

describe("page slug rules", () => {
  test("accepts lowercase ASCII slugs", () => {
    expect(isValidSlug("acasa")).toBe(true);
    expect(isValidSlug("despre")).toBe(true);
    expect(isValidSlug("home")).toBe(true);
    expect(isValidSlug("puterea-cuvintelor")).toBe(true);
    expect(isValidSlug("evenimente-2026")).toBe(true);
    expect(isValidSlug("a")).toBe(true);
  });

  test("rejects empty slugs with a structured failure", () => {
    const result = checkSlug("");
    expect(result).not.toBeNull();
    expect(result!.code).toBe("slug.empty");
  });

  test("rejects slashes — nested hierarchy is out of scope for v1", () => {
    const result = checkSlug("blog/post");
    expect(result).not.toBeNull();
    expect(result!.code).toBe("slug.containsSlash");
  });

  test("rejects uppercase letters", () => {
    expect(isValidSlug("Despre")).toBe(false);
    expect(isValidSlug("DESPRE")).toBe(false);
  });

  test("rejects spaces and accented characters", () => {
    const space = checkSlug("puterea cuvintelor");
    expect(space).not.toBeNull();
    expect(space!.code).toBe("slug.invalidCharacters");
    const accented = checkSlug("acasă");
    expect(accented).not.toBeNull();
    expect(accented!.code).toBe("slug.invalidCharacters");
  });

  test("rejects leading or trailing hyphens", () => {
    expect(isValidSlug("-despre")).toBe(false);
    expect(isValidSlug("despre-")).toBe(false);
  });

  test("rejects double hyphens (not idiomatic in URL slugs)", () => {
    expect(isValidSlug("a--b")).toBe(false);
  });

  test("rejects only-hyphen slugs", () => {
    expect(isValidSlug("-")).toBe(false);
    expect(isValidSlug("---")).toBe(false);
  });

  test("rejects underscores and dots", () => {
    expect(isValidSlug("about_us")).toBe(false);
    expect(isValidSlug("about.us")).toBe(false);
  });

  test("checkSlug returns a human-readable message", () => {
    const result = checkSlug("Bad Slug!");
    expect(result).not.toBeNull();
    expect(typeof result!.message).toBe("string");
    expect(result!.message.length).toBeGreaterThan(0);
  });
});
