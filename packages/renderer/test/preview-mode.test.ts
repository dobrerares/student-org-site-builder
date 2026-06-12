import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import multiPage from "./fixtures/multi-page.json" with { type: "json" };
import heroOnly from "./fixtures/hero-only.json" with { type: "json" };
import { renderSite } from "../src/index.js";

const fixture = multiPage as unknown as Site;
const singlePage = heroOnly as unknown as Site;

/**
 * AC: in preview mode, the renderer emits a small inline script that
 * intercepts same-origin anchor clicks and postMessages the host with
 * the requested path. This prevents the preview iframe (loaded via
 * `srcdoc`, no backing server) from navigating to a 404 on the editor's
 * own origin when the user clicks a nav link.
 *
 * The mode is opt-in via `RenderOptions.mode = "preview"`. The default
 * (deploy) is unchanged — built static sites never carry this script.
 */
describe("renderSite — preview mode nav interception", () => {
  test("default (deploy) mode does NOT emit the preview-nav script", () => {
    const html = renderSite(fixture, "stub");
    expect(html).not.toContain("data-sosb-preview-nav");
  });

  test("preview mode emits an inline script tagged data-sosb-preview-nav", () => {
    const html = renderSite(fixture, "stub", { mode: "preview" });
    expect(html).toMatch(/<script[^>]*data-sosb-preview-nav/);
  });

  test("preview mode skips the script when there is no nav (single-page site)", () => {
    const html = renderSite(singlePage, "stub", { mode: "preview" });
    expect(html).not.toContain("data-sosb-preview-nav");
  });

  test("preview-mode script uses the bridge envelope (sosb:preview channel)", () => {
    const html = renderSite(fixture, "stub", { mode: "preview" });
    expect(html).toContain("sosb:preview");
    expect(html).toContain("navigate");
  });

  test("preview mode is deterministic — repeated renders are byte-identical", () => {
    const a = renderSite(fixture, "stub", { mode: "preview" });
    const b = renderSite(fixture, "stub", { mode: "preview" });
    expect(a).toBe(b);
  });

  test("assetUrlForPath rewrites preview asset URLs without changing deploy defaults", () => {
    const deploy = renderSite(singlePage, "stub");
    expect(deploy).toContain('src="assets/hero.jpg"');
    expect(deploy).toContain('content="assets/hero.jpg"');

    const preview = renderSite(singlePage, "stub", {
      mode: "preview",
      assetUrlForPath: (path) => (path === "assets/hero.jpg" ? "blob:hero-preview" : undefined),
    });

    expect(preview).toContain('src="blob:hero-preview"');
    expect(preview).toContain('content="blob:hero-preview"');
    expect(preview).not.toContain('src="assets/hero.jpg"');
  });
});
