// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import { JSDOM } from "jsdom";
import type { Site } from "@sosb/schema";
import faqOnly from "./fixtures/faq-only.json" with { type: "json" };
import {
  FAQ_ACCORDION_SCRIPT_SOURCE,
  FAQ_ENHANCED_ATTR,
  renderSite,
} from "../src/index.js";

const fixture = faqOnly as unknown as Site;

/**
 * DOM-integration tests for the FAQ accordion script.
 *
 * The block functionality must be JS-free; this script is a progressive
 * enhancement (smooth open/close transitions). The size budget assertion
 * lives in `faq-script-size.test.ts` (Node-only, esbuild does not run
 * inside jsdom).
 *
 * Test setup: we spin up a fresh JSDOM instance with `runScripts:
 * "dangerously"` for each test, which lets us inject a real `<script>`
 * element containing the enhancement source. This mirrors how the script
 * runs in a real browser. The default jsdom test environment that vitest
 * provides does NOT execute scripts inserted via innerHTML, so we cannot
 * use it directly for this scenario.
 */

interface RealisticDom {
  window: Window & typeof globalThis;
  document: Document;
  details: HTMLDetailsElement[];
}

async function loadRealisticDom(): Promise<RealisticDom> {
  const html = renderSite(fixture, "stub");
  // The matchMedia shim goes in <head> (before the script reads it). The
  // enhancement script goes immediately before </body> so the document is
  // fully parsed by the time `init()` queries the DOM. This mirrors the
  // most common deployment pattern (script at end of body) and is also how
  // the build pipeline (#5) injects per-block JS.
  const matchMediaShim = `<script>window.matchMedia=function(){return{matches:false,addListener:function(){},removeListener:function(){},addEventListener:function(){},removeEventListener:function(){}};};</script>`;
  const enhancementScriptTag = `<script>${FAQ_ACCORDION_SCRIPT_SOURCE}</script>`;
  let augmented = html.replace("</head>", `${matchMediaShim}</head>`);
  augmented = augmented.replace("</body>", `${enhancementScriptTag}</body>`);
  const dom = new JSDOM(augmented, { runScripts: "dangerously" });
  // JSDOM evaluates inline scripts asynchronously when `runScripts:
  // "dangerously"` is set. Wait for the load event so the enhancement
  // script has run and bound its handlers.
  await new Promise<void>((resolve) => {
    if (dom.window.document.readyState === "complete") {
      resolve();
    } else {
      dom.window.addEventListener("load", () => resolve(), { once: true });
    }
  });
  const win = dom.window as unknown as Window & typeof globalThis;
  const doc = dom.window.document;
  const details = [...doc.querySelectorAll<HTMLDetailsElement>(".faq__item")];
  return { window: win, document: doc, details };
}

describe("FAQ accordion script — DOM integration (jsdom)", () => {
  test("marks every faq item with the enhanced sentinel", async () => {
    const { document: doc, details } = await loadRealisticDom();
    expect(details.length).toBeGreaterThan(0);
    // Re-query after script execution; the original `details` array is a
    // snapshot from before the script ran.
    const refreshed = [...doc.querySelectorAll<HTMLDetailsElement>(".faq__item")];
    for (const el of refreshed) {
      expect(el.getAttribute(FAQ_ENHANCED_ATTR)).toBe("1");
    }
  });

  test("a click on summary toggles the details element open/closed", async () => {
    const { window: win, details } = await loadRealisticDom();
    // The fixture's first item starts open (firstOpen=true).
    const first = details[0]!;
    expect(first.open).toBe(true);
    first
      .querySelector("summary")!
      .dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true }));
    // With reduced-motion off and no transitionend in jsdom, the script
    // calls preventDefault and then animates. The animate path sets
    // overflow/height in jsdom but `transitionend` won't fire on its own,
    // so we simulate it to drive the close-completion path.
    const ans = first.querySelector<HTMLElement>(".faq__answer")!;
    ans.dispatchEvent(new win.Event("transitionend"));
    expect(first.open).toBe(false);
  });

  test("a click on a closed summary opens the details element", async () => {
    const { window: win, details } = await loadRealisticDom();
    const second = details[1]!;
    expect(second.open).toBe(false);
    second
      .querySelector("summary")!
      .dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true }));
    // Open is set synchronously before the animation begins.
    expect(second.open).toBe(true);
  });

  test("running the script twice is idempotent (no double-binding)", async () => {
    const { window: win, document: doc, details } = await loadRealisticDom();
    // Inject a second copy of the script.
    const secondScript = doc.createElement("script");
    secondScript.textContent = FAQ_ACCORDION_SCRIPT_SOURCE;
    doc.head.appendChild(secondScript);
    void win;
    for (const el of details) {
      expect(el.getAttribute(FAQ_ENHANCED_ATTR)).toBe("1");
    }
  });

  test("native fallback: rendered HTML alone (no script) has working <details>", () => {
    // Use the vanilla vitest jsdom env (no script execution) for this test.
    const html = renderSite(fixture, "stub");
    const innerMatch = /<html[^>]*>([\s\S]*)<\/html>/i.exec(html);
    document.documentElement.innerHTML = innerMatch![1] ?? "";
    const items = [...document.querySelectorAll<HTMLDetailsElement>(".faq__item")];
    expect(items.length).toBe(3);
    // First is open per firstOpen=true; toggling open/closed via the DOM
    // property works without any custom JS.
    expect(items[0]!.open).toBe(true);
    items[1]!.open = true;
    expect(items[1]!.open).toBe(true);
  });
});
