import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import multiPage from "./fixtures/multi-page.json" with { type: "json" };
import heroOnly from "./fixtures/hero-only.json" with { type: "json" };
import { renderSite } from "../src/index.js";

const fixture = multiPage as unknown as Site;
const singlePage = heroOnly as unknown as Site;

/**
 * AC: Renderer produces correct nav with active-page highlighting.
 *
 * The page shell renders a `<nav data-site-nav>` block when more than one
 * page in the active language has `showInNav: true`. Each entry links to
 * `pagePath(site, page)` and the active entry is marked with
 * `aria-current="page"` and `data-active="true"`.
 */
describe("renderSite — multi-page navigation", () => {
  test("emits a nav landmark when there are multiple in-nav pages", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/<nav[^>]*data-site-nav/);
    expect(html).toMatch(/aria-label="Site navigation"/);
  });

  test("nav lists every showInNav=true page in the active language, ordered by navOrder", () => {
    const html = renderSite(fixture, "stub");
    const navMatch = /<nav[^>]*data-site-nav[^>]*>([\s\S]*?)<\/nav>/.exec(html);
    expect(navMatch).not.toBeNull();
    const nav = navMatch![1]!;
    const acasaIdx = nav.indexOf("Acasă");
    const despreIdx = nav.indexOf("Despre");
    const thanksIdx = nav.indexOf("Mulțumim");
    expect(acasaIdx).toBeGreaterThanOrEqual(0);
    expect(despreIdx).toBeGreaterThanOrEqual(0);
    expect(thanksIdx).toBe(-1);
    expect(acasaIdx).toBeLessThan(despreIdx);
  });

  test("home link is '/', non-home links are '/<slug>/'", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/<a[^>]*href="\/"/);
    expect(html).toMatch(/<a[^>]*href="\/despre\/"/);
  });

  test("active page is marked with aria-current and data-active", () => {
    const home = renderSite(fixture, "stub");
    expect(home).toMatch(/<a[^>]*href="\/"[^>]*data-active="true"/);
    expect(home).toMatch(/aria-current="page"/);
    expect(home).toMatch(/<a[^>]*href="\/despre\/"[^>]*data-active="false"/);

    const about = renderSite(fixture, "stub", { pageIndex: 1 });
    expect(about).toMatch(/<a[^>]*href="\/despre\/"[^>]*data-active="true"/);
    expect(about).toMatch(/<a[^>]*href="\/"[^>]*data-active="false"/);
  });

  test("renders the org logo as a brand link in multi-page nav when present", () => {
    const withLogo = structuredClone(fixture) as Site;
    withLogo.org.logo = {
      hash: "logo",
      path: "assets/logo.png",
      metadataPath: "assets/logo.metadata.json",
      mime: "image/png",
      width: 512,
      height: 512,
      alt: "Stub Org logo",
    };
    withLogo.org.logoAlt = "Stub Org logo";

    const html = renderSite(withLogo, "stub");
    const navMatch = /<nav[^>]*data-site-nav[^>]*>([\s\S]*?)<\/nav>/.exec(html);
    expect(navMatch).not.toBeNull();
    const nav = navMatch![1]!;
    expect(nav).toContain('class="site-nav__brand"');
    expect(nav).toContain('href="/"');
    expect(nav).toContain('class="site-nav__logo"');
    expect(nav).toContain('src="assets/logo.png"');
    expect(nav).toContain('alt="Stub Org logo"');
  });

  test("does NOT emit nav when only one page is in-nav", () => {
    const html = renderSite(singlePage, "stub");
    expect(html).not.toMatch(/<nav[^>]*data-site-nav/);
  });

  test("per-page render produces distinct HTML by page index", () => {
    const home = renderSite(fixture, "stub", { pageIndex: 0 });
    const about = renderSite(fixture, "stub", { pageIndex: 1 });
    expect(home).not.toBe(about);
    expect(home).toContain("<title>Stub — Acasă</title>");
    expect(about).toContain("<title>Stub — Despre</title>");
  });

  test("non-home page sets html lang to its own lang", () => {
    const html = renderSite(fixture, "stub", { pageIndex: 1 });
    expect(html).toMatch(/<html[^>]*lang="ro"/);
  });

  test("determinism: repeated multi-page renders are byte-identical", () => {
    const a = renderSite(fixture, "stub", { pageIndex: 1 });
    const b = renderSite(fixture, "stub", { pageIndex: 1 });
    expect(a).toBe(b);
  });
});
