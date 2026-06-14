import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import singlePageSite from "./fixtures/single-page-site.json" with { type: "json" };
import { build } from "../src/index.js";
import { textOf } from "./helpers/dist-text.js";

const fixture = singlePageSite as unknown as Site;

/**
 * AC #5 — End-to-end test: `build()` output validated against a known-good
 * snapshot.
 *
 * Each emitted file is captured to its own golden file under
 * `__golden__/dist/`. We snapshot per-file rather than serialising the whole
 * Map so that a regression in `index.html` does not whole-cloth invalidate
 * the `robots.txt` and `sitemap.xml` snapshots, and PR diffs read naturally
 * (an HTML diff vs. an XML diff).
 *
 * The snapshot is taken with the `siteUrl` set so the build-pipeline overlay
 * (canonical / og:url / og:image / robots Sitemap / absolute sitemap loc) is
 * exercised end-to-end. A separate snapshot covers the no-siteUrl case.
 */
describe("build — end-to-end snapshot", () => {
  describe("with siteUrl (full overlay)", () => {
    const dist = build(fixture, { siteUrl: "https://stub.example.org" });

    test("dist/index.html matches its golden file", async () => {
      await expect(textOf(dist, "index.html")).toMatchFileSnapshot(
        "__golden__/with-site-url/index.html",
      );
    });

    test("dist/robots.txt matches its golden file", async () => {
      await expect(textOf(dist, "robots.txt")).toMatchFileSnapshot(
        "__golden__/with-site-url/robots.txt",
      );
    });

    test("dist/sitemap.xml matches its golden file", async () => {
      await expect(textOf(dist, "sitemap.xml")).toMatchFileSnapshot(
        "__golden__/with-site-url/sitemap.xml",
      );
    });

    test("dist/_lighthouse-budget.json matches its golden file", async () => {
      await expect(textOf(dist, "_lighthouse-budget.json")).toMatchFileSnapshot(
        "__golden__/with-site-url/_lighthouse-budget.json",
      );
    });
  });

  describe("without siteUrl (renderer-only HTML, relative-loc sitemap, no robots Sitemap)", () => {
    const dist = build(fixture);

    test("dist/index.html matches its golden file", async () => {
      await expect(textOf(dist, "index.html")).toMatchFileSnapshot(
        "__golden__/no-site-url/index.html",
      );
    });

    test("dist/robots.txt matches its golden file", async () => {
      await expect(textOf(dist, "robots.txt")).toMatchFileSnapshot(
        "__golden__/no-site-url/robots.txt",
      );
    });

    test("dist/sitemap.xml matches its golden file", async () => {
      await expect(textOf(dist, "sitemap.xml")).toMatchFileSnapshot(
        "__golden__/no-site-url/sitemap.xml",
      );
    });

    test("dist/_lighthouse-budget.json matches its golden file", async () => {
      await expect(textOf(dist, "_lighthouse-budget.json")).toMatchFileSnapshot(
        "__golden__/no-site-url/_lighthouse-budget.json",
      );
    });
  });
});
