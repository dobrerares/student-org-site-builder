import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import multiPage from "./fixtures/multi-page.json" with { type: "json" };
import heroOnly from "./fixtures/hero-only.json" with { type: "json" };
import { JSDOM, VirtualConsole } from "jsdom";
import { renderSite } from "../src/index.js";
import { PREVIEW_NAV_SCRIPT } from "../src/preview-nav-script.js";

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

  test("preview mode emits the script for single-page sites too", () => {
    // A one-page site still has links — hero CTAs, CTA banners, footer and
    // rich-text links. Skipping the interceptor here let the first CTA click
    // navigate the preview iframe off the editor's origin.
    const html = renderSite(singlePage, "stub", { mode: "preview" });
    expect(html).toMatch(/<script[^>]*data-sosb-preview-nav/);
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

/**
 * Behaviour of the emitted interceptor, exercised by evaluating the script
 * source in a jsdom document rather than asserting on its text. The script is
 * a plain-JS string constant (it cannot be imported), so evaluation is the
 * only way to test what it actually does.
 */
describe("PREVIEW_NAV_SCRIPT — click behaviour", () => {
  function setup(html: string): {
    readonly doc: Document;
    readonly posted: unknown[];
    readonly opened: string[];
  } {
    // Links the interceptor deliberately does NOT intercept (hash, mailto:)
    // reach jsdom's navigation stub, which logs a "Not implemented" jsdomError.
    // That is the behaviour under test, so the noise is swallowed here.
    const virtualConsole = new VirtualConsole();
    const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`, {
      runScripts: "outside-only",
      virtualConsole,
    });
    const posted: unknown[] = [];
    const opened: string[] = [];
    const win = dom.window as unknown as {
      parent: unknown;
      open: (url: string) => void;
      eval: (code: string) => void;
    };
    // Pretend we are framed: the script no-ops in a top-level window.
    win.parent = { postMessage: (msg: unknown) => posted.push(msg) };
    win.open = (url: string) => opened.push(url);
    win.eval(PREVIEW_NAV_SCRIPT);
    return { doc: dom.window.document, posted, opened };
  }

  function click(doc: Document, selector: string): boolean {
    const el = doc.querySelector(selector)!;
    const event = doc.defaultView!.document.createEvent("MouseEvent") as MouseEvent & {
      initMouseEvent: (...args: unknown[]) => void;
    };
    event.initMouseEvent(
      "click",
      true,
      true,
      doc.defaultView,
      0,
      0,
      0,
      0,
      0,
      false,
      false,
      false,
      false,
      0,
      null,
    );
    el.dispatchEvent(event);
    return event.defaultPrevented;
  }

  test("posts a navigate message for an absolute intra-site path", () => {
    const { doc, posted } = setup('<a id="l" href="/despre/">Despre</a>');
    expect(click(doc, "#l")).toBe(true);
    expect(posted).toEqual([
      { channel: "sosb:preview", version: 1, payload: { type: "navigate", path: "/despre/" } },
    ]);
  });

  test("forwards a relative intra-site path verbatim for the host to resolve", () => {
    const { doc, posted } = setup('<a id="l" href="../contact/">Contact</a>');
    expect(click(doc, "#l")).toBe(true);
    expect(posted).toEqual([
      { channel: "sosb:preview", version: 1, payload: { type: "navigate", path: "../contact/" } },
    ]);
  });

  test("lets in-page hash links scroll natively", () => {
    const { doc, posted, opened } = setup('<a id="l" href="#echipa">Echipa</a>');
    expect(click(doc, "#l")).toBe(false);
    expect(posted).toEqual([]);
    expect(opened).toEqual([]);
  });

  test("lets mailto:, tel: and sms: hand off to the OS", () => {
    for (const href of ["mailto:a@b.ro", "tel:+40123", "sms:+40123"]) {
      const { doc, posted, opened } = setup(`<a id="l" href="${href}">x</a>`);
      expect(click(doc, "#l")).toBe(false);
      expect(posted).toEqual([]);
      expect(opened).toEqual([]);
    }
  });

  test("opens external links in a new tab instead of replacing the preview", () => {
    const { doc, posted, opened } = setup('<a id="l" href="https://partener.ro/">Partener</a>');
    expect(click(doc, "#l")).toBe(true);
    expect(posted).toEqual([]);
    expect(opened).toEqual(["https://partener.ro/"]);
  });

  test("treats protocol-relative URLs as external", () => {
    const { doc, opened } = setup('<a id="l" href="//cdn.example/x">CDN</a>');
    expect(click(doc, "#l")).toBe(true);
    expect(opened).toEqual(["//cdn.example/x"]);
  });

  test("intercepts clicks on elements nested inside the anchor", () => {
    const { doc, posted } = setup('<a id="l" href="/despre/"><span id="inner">go</span></a>');
    expect(click(doc, "#inner")).toBe(true);
    expect(posted).toHaveLength(1);
  });
});
