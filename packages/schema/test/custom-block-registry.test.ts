/**
 * The Custom Block registry (ADR 0055): what a Site's installed packages make
 * available, and the three ways a type can be unavailable — the issue-106
 * plan's "missing required extension" and "extension requires a newer
 * builder", plus data newer than the installed declaration.
 */
import { describe, expect, test } from "vitest";
import {
  EMPTY_CUSTOM_BLOCK_REGISTRY,
  buildCustomBlockRegistry,
  customBlockAvailabilityFor,
  parseCustomBlockDeclaration,
  type CustomBlockDeclaration,
} from "../src/index.js";
import { PARTNERS_DECLARATION } from "./fixtures/partners-declaration.js";

function decl(overrides: Partial<CustomBlockDeclaration> = {}): CustomBlockDeclaration {
  const result = parseCustomBlockDeclaration({ ...PARTNERS_DECLARATION, ...overrides });
  if (!result.ok) throw new Error(result.message);
  return result.declaration;
}

describe("buildCustomBlockRegistry", () => {
  test("a loaded package makes its types available, sorted", () => {
    const registry = buildCustomBlockRegistry([
      {
        packageId: "org.example.practice",
        packageVersion: "1.2.0",
        declarations: [decl({ type: "org.example/zeta" }), decl({ type: "org.example/alpha" })],
      },
    ]);
    expect(registry.available.map((e) => e.declaration.type)).toEqual([
      "org.example/alpha",
      "org.example/zeta",
    ]);
    const entry = registry.lookup("org.example/alpha");
    expect(entry?.status).toBe("available");
    if (entry?.status === "available") expect(entry.packageId).toBe("org.example.practice");
  });

  test("built-in and unknown non-namespaced types are not the registry's business", () => {
    expect(EMPTY_CUSTOM_BLOCK_REGISTRY.lookup("hero")).toBeUndefined();
    expect(EMPTY_CUSTOM_BLOCK_REGISTRY.lookup("futureBlock")).toBeUndefined();
  });

  test("a namespaced type no package declares is missing", () => {
    const entry = EMPTY_CUSTOM_BLOCK_REGISTRY.lookup("org.example/partners");
    expect(entry).toMatchObject({ status: "unavailable", reason: "package-missing" });
    expect((entry as { message: string }).message).toMatch(/not installed/);
  });

  test("a package that needs a newer builder makes its declared types say so", () => {
    const registry = buildCustomBlockRegistry(
      [],
      [
        {
          packageId: "org.example.future",
          errorCode: "format-version-unsupported",
          message: "This Theme package uses format version 2",
          declaredTypes: ["org.example/partners"],
        },
      ],
    );
    const entry = registry.lookup("org.example/partners");
    expect(entry).toMatchObject({
      status: "unavailable",
      reason: "needs-newer-builder",
      packageId: "org.example.future",
    });
    expect((entry as { message: string }).message).toMatch(/newer version of the builder/);
  });

  test("a package that failed for another reason is damaged", () => {
    const registry = buildCustomBlockRegistry(
      [],
      [
        {
          packageId: "org.example.broken",
          errorCode: "block-invalid",
          message: 'Field "fields.tint" declares kind "color"',
          declaredTypes: ["org.example/partners"],
        },
      ],
    );
    expect(registry.lookup("org.example/partners")).toMatchObject({
      status: "unavailable",
      reason: "package-damaged",
    });
  });

  test("two loaded packages declaring the same type resolve deterministically", () => {
    const a = {
      packageId: "org.b.pkg",
      packageVersion: "1.0.0",
      declarations: [decl({ version: 2 })],
    };
    const b = {
      packageId: "org.a.pkg",
      packageVersion: "1.0.0",
      declarations: [decl({ version: 7 })],
    };
    const first = buildCustomBlockRegistry([a, b]).lookup("org.example/partners");
    const second = buildCustomBlockRegistry([b, a]).lookup("org.example/partners");
    expect(first).toEqual(second);
    if (first?.status === "available") expect(first.packageId).toBe("org.a.pkg");
  });
});

describe("customBlockAvailabilityFor", () => {
  const registry = buildCustomBlockRegistry([
    {
      packageId: "org.example.practice",
      packageVersion: "1.2.0",
      declarations: [decl({ version: 2 })],
    },
  ]);

  test("a Block at the declaration's version is available", () => {
    expect(
      customBlockAvailabilityFor(registry, { type: "org.example/partners", version: 2 })?.status,
    ).toBe("available");
  });

  test("a Block saved by a newer package is unavailable, with content preserved", () => {
    const entry = customBlockAvailabilityFor(registry, {
      type: "org.example/partners",
      version: 3,
    });
    expect(entry).toMatchObject({ status: "unavailable", reason: "data-newer" });
    expect((entry as { message: string }).message).toMatch(/data version 3.*understands 2/);
  });

  test("a Block saved by an older package stays available (the update flow adapts it)", () => {
    expect(
      customBlockAvailabilityFor(registry, { type: "org.example/partners", version: 1 })?.status,
    ).toBe("available");
  });
});
