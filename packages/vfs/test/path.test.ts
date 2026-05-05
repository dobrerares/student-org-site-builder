import { describe, expect, test } from "vitest";
import { validatePath, validatePrefix, VfsInvalidPathError } from "../src/index.js";

describe("validatePath", () => {
  test("accepts a simple file path", () => {
    expect(validatePath("a.txt")).toBe("a.txt");
  });

  test("accepts a nested path", () => {
    expect(validatePath("assets/8e3a7f.png")).toBe("assets/8e3a7f.png");
  });

  test("rejects empty string", () => {
    expect(() => validatePath("")).toThrow(VfsInvalidPathError);
  });

  test("rejects leading slash", () => {
    expect(() => validatePath("/abs.txt")).toThrow(VfsInvalidPathError);
  });

  test("rejects backslash", () => {
    expect(() => validatePath("a\\b")).toThrow(VfsInvalidPathError);
  });

  test("rejects '..' segment", () => {
    expect(() => validatePath("a/../b")).toThrow(VfsInvalidPathError);
  });

  test("rejects '.' segment", () => {
    expect(() => validatePath("a/./b")).toThrow(VfsInvalidPathError);
  });

  test("rejects empty intermediate segment (double slash)", () => {
    expect(() => validatePath("a//b")).toThrow(VfsInvalidPathError);
  });

  test("rejects trailing slash on a regular path", () => {
    // A regular path is not a directory listing prefix; we keep them distinct.
    expect(() => validatePath("a/")).toThrow(VfsInvalidPathError);
  });
});

describe("validatePrefix", () => {
  test("undefined and empty string are both 'all paths'", () => {
    expect(validatePrefix(undefined)).toBe("");
    expect(validatePrefix("")).toBe("");
  });

  test("accepts a simple prefix", () => {
    expect(validatePrefix("assets")).toBe("assets");
  });

  test("accepts a directory-style trailing slash", () => {
    expect(validatePrefix("assets/")).toBe("assets/");
  });

  test("rejects leading slash", () => {
    expect(() => validatePrefix("/abs")).toThrow(VfsInvalidPathError);
  });

  test("rejects '..' inside the prefix", () => {
    expect(() => validatePrefix("a/../b/")).toThrow(VfsInvalidPathError);
  });
});
