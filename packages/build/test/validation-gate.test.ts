import { describe, expect, test, vi } from "vitest";
import type { Site } from "@sosb/schema";

import singlePageSite from "./fixtures/single-page-site.json" with { type: "json" };
import { build } from "../src/index.js";

const fixture = singlePageSite as unknown as Site;

/**
 * AC #6: the build pipeline runs the same validation as the editor.
 *
 * - Errors fail the build (the function throws, surfacing the issue list).
 * - Warnings are logged but do not fail the build.
 *
 * The build module is pure (no `console.log` side-effects in the happy
 * path), so callers can pass an `onWarning` reporter to receive the
 * warning list.
 */
describe("build — validation gate (AC #6)", () => {
  test("clean fixture builds without throwing", () => {
    expect(() => build(fixture)).not.toThrow();
  });

  test("a site with schema errors throws a BuildValidationError carrying the errors", () => {
    // Construct a broken site by emptying the org name (schema requires min 1).
    const broken = structuredClone(fixture) as Site & { org: { name: string } };
    broken.org.name = "";

    let thrown: unknown;
    try {
      build(broken);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeDefined();
    expect(thrown).toBeInstanceOf(Error);
    const err = thrown as Error & { errors?: { code: string }[] };
    expect(Array.isArray(err.errors)).toBe(true);
    expect((err.errors ?? []).length).toBeGreaterThan(0);
  });

  test("a site with warnings (no errors) builds successfully", () => {
    // Hero with backgroundImage but no backgroundAlt is a warning, not an error.
    const withWarning = structuredClone(fixture);
    const homePage = withWarning.pages[0];
    if (homePage === undefined) throw new Error("fixture must have a page");
    const firstBlock = homePage.blocks[0];
    if (firstBlock === undefined) throw new Error("fixture must have a block");
    if (firstBlock.type === "hero") {
      (firstBlock.data as { backgroundImage?: string }).backgroundImage = "assets/x.jpg";
      // backgroundAlt remains undefined → triggers warning.
    }

    expect(() => build(withWarning)).not.toThrow();
  });

  test("warnings flow through the optional onWarning reporter", () => {
    const withWarning = structuredClone(fixture);
    const homePage = withWarning.pages[0];
    if (homePage === undefined) throw new Error("fixture must have a page");
    const firstBlock = homePage.blocks[0];
    if (firstBlock === undefined) throw new Error("fixture must have a block");
    if (firstBlock.type === "hero") {
      (firstBlock.data as { backgroundImage?: string }).backgroundImage = "assets/x.jpg";
    }

    const reporter = vi.fn();
    build(withWarning, { onWarning: reporter });
    // At least one warning fires (the missing backgroundAlt one).
    expect(reporter).toHaveBeenCalled();
    const firstCallArg = reporter.mock.calls[0]?.[0] as { code: string } | undefined;
    expect(firstCallArg?.code).toBeTruthy();
  });

  test("the thrown error's name is `BuildValidationError`", () => {
    const broken = structuredClone(fixture) as Site & { org: { name: string } };
    broken.org.name = "";
    let thrown: Error | undefined;
    try {
      build(broken);
    } catch (e) {
      thrown = e as Error;
    }
    expect(thrown?.name).toBe("BuildValidationError");
  });
});
