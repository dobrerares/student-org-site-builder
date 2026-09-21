/**
 * The preview's in-place DOM diff.
 *
 * These tests are the safety net for the behaviour the editor's live preview
 * depends on: applying a freshly-rendered document to the live one must leave
 * everything the user created — scroll position, an opened FAQ answer, an open
 * lightbox, focus — exactly where it was, and must never re-run a script.
 *
 * The morph ships as a plain-JS source string (it is inlined into the rendered
 * document, so it cannot be an importable module). The tests therefore
 * evaluate that string in a jsdom window and drive the `apply` entry point the
 * script exposes on `window.__sosbPreviewMorph`.
 */
import { beforeEach, describe, expect, test } from "vitest";
import { JSDOM, VirtualConsole } from "jsdom";
import type { Site } from "@sosb/schema";
import faqOnly from "./fixtures/faq-only.json" with { type: "json" };
import heroOnly from "./fixtures/hero-only.json" with { type: "json" };
import { renderSite } from "../src/index.js";
import {
  PREVIEW_MORPH_SCRIPT,
  PREVIEW_MORPH_SCRIPT_MARKER,
} from "../src/preview-morph-script.js";

interface Harness {
  readonly dom: JSDOM;
  readonly doc: Document;
  readonly posted: { type: string; [k: string]: unknown }[];
  apply(html: string): void;
  receive(payload: unknown): void;
}

function boot(html: string): Harness {
  const virtualConsole = new VirtualConsole();
  const dom = new JSDOM(html, { runScripts: "outside-only", virtualConsole });
  const posted: { type: string; [k: string]: unknown }[] = [];
  const win = dom.window as unknown as {
    parent: unknown;
    eval: (code: string) => void;
    __sosbPreviewMorph?: (html: string) => void;
  };
  win.parent = {
    postMessage: (msg: { payload: { type: string } }) => posted.push(msg.payload),
  };
  win.eval(PREVIEW_MORPH_SCRIPT);
  return {
    dom,
    doc: dom.window.document,
    posted,
    apply(next: string) {
      win.__sosbPreviewMorph!(next);
    },
    receive(payload: unknown) {
      dom.window.dispatchEvent(
        new dom.window.MessageEvent("message", {
          data: { channel: "sosb:preview", version: 1, payload },
        }),
      );
    },
  };
}

function page(body: string, head = "<title>t</title>"): string {
  return `<!doctype html><html lang="ro"><head>${head}</head><body>${body}</body></html>`;
}

describe("PREVIEW_MORPH_SCRIPT — protocol coupling", () => {
  test("speaks the bridge channel and the previewHtml payload type", () => {
    expect(PREVIEW_MORPH_SCRIPT).toContain("sosb:preview");
    expect(PREVIEW_MORPH_SCRIPT).toContain("previewHtml");
    expect(PREVIEW_MORPH_SCRIPT).toContain("ready");
  });

  test("announces readiness to the host on boot", () => {
    const h = boot(page("<main></main>"));
    expect(h.posted).toEqual([{ type: "ready" }]);
  });

  test("applies HTML delivered over the bridge envelope", () => {
    const h = boot(page("<main><h1>Vechi</h1></main>"));
    h.receive({ type: "previewHtml", html: page("<main><h1>Nou</h1></main>") });
    expect(h.doc.querySelector("h1")!.textContent).toBe("Nou");
  });

  test("ignores envelopes from another channel or version", () => {
    const h = boot(page("<main><h1>Vechi</h1></main>"));
    h.dom.window.dispatchEvent(
      new h.dom.window.MessageEvent("message", {
        data: { channel: "other", version: 1, payload: { type: "previewHtml", html: page("<main><h1>X</h1></main>") } },
      }),
    );
    h.dom.window.dispatchEvent(
      new h.dom.window.MessageEvent("message", {
        data: { channel: "sosb:preview", version: 99, payload: { type: "previewHtml", html: page("<main><h1>X</h1></main>") } },
      }),
    );
    expect(h.doc.querySelector("h1")!.textContent).toBe("Vechi");
  });
});

describe("morph — text and attribute patching", () => {
  test("updates text in place without replacing the element", () => {
    const h = boot(page('<main><h1 id="t">Vechi</h1></main>'));
    const before = h.doc.querySelector("#t");
    h.apply(page('<main><h1 id="t">Nou</h1></main>'));
    expect(h.doc.querySelector("#t")!.textContent).toBe("Nou");
    // Same node object: the element was patched, not swapped out.
    expect(h.doc.querySelector("#t")).toBe(before);
  });

  test("adds, changes and removes attributes", () => {
    const h = boot(page('<main><a id="l" href="/a/" data-gone="1">x</a></main>'));
    h.apply(page('<main><a id="l" href="/b/" data-new="2">x</a></main>'));
    const a = h.doc.querySelector("#l")!;
    expect(a.getAttribute("href")).toBe("/b/");
    expect(a.getAttribute("data-new")).toBe("2");
    expect(a.hasAttribute("data-gone")).toBe(false);
  });

  test("syncs attributes on the root html element", () => {
    const h = boot(page("<main></main>"));
    h.apply('<!doctype html><html lang="en"><head></head><body><main></main></body></html>');
    expect(h.doc.documentElement.getAttribute("lang")).toBe("en");
  });

  test("updates the stylesheet through textContent, keeping the same node", () => {
    const h = boot(page("<main></main>", "<title>t</title><style>a{color:red}</style>"));
    const style = h.doc.querySelector("style");
    h.apply(page("<main></main>", "<title>t</title><style>a{color:blue}</style>"));
    expect(h.doc.querySelector("style")).toBe(style);
    expect(h.doc.querySelector("style")!.textContent).toBe("a{color:blue}");
  });

  test("updates the document title", () => {
    const h = boot(page("<main></main>", "<title>Vechi</title>"));
    h.apply(page("<main></main>", "<title>Nou</title>"));
    expect(h.doc.title).toBe("Nou");
  });
});

describe("morph — structural changes", () => {
  test("appends new children", () => {
    const h = boot(page("<main><p>1</p></main>"));
    h.apply(page("<main><p>1</p><p>2</p></main>"));
    expect(h.doc.querySelectorAll("main p")).toHaveLength(2);
  });

  test("removes deleted children", () => {
    const h = boot(page("<main><p>1</p><p>2</p></main>"));
    h.apply(page("<main><p>1</p></main>"));
    expect(h.doc.querySelectorAll("main p")).toHaveLength(1);
    expect(h.doc.querySelector("main")!.textContent).toBe("1");
  });

  test("reuses an id-keyed node that moved", () => {
    const h = boot(page('<main><p id="a">A</p><p id="b">B</p></main>'));
    const a = h.doc.querySelector("#a");
    h.apply(page('<main><p id="b">B</p><p id="a">A</p></main>'));
    expect(h.doc.querySelector("#a")).toBe(a);
    expect(h.doc.querySelector("main")!.textContent).toBe("BA");
  });

  test("replaces a node whose tag changed", () => {
    const h = boot(page("<main><p>x</p></main>"));
    h.apply(page("<main><div>x</div></main>"));
    expect(h.doc.querySelector("main p")).toBeNull();
    expect(h.doc.querySelector("main div")!.textContent).toBe("x");
  });

  test("is idempotent — applying the same HTML twice changes nothing", () => {
    const h = boot(page('<main><h1 id="t">Titlu</h1><p>corp</p></main>'));
    const target = page('<main><h1 id="t">Nou</h1><p>corp</p><p>extra</p></main>');
    h.apply(target);
    const first = h.doc.body.innerHTML;
    const node = h.doc.querySelector("#t");
    h.apply(target);
    expect(h.doc.body.innerHTML).toBe(first);
    expect(h.doc.querySelector("#t")).toBe(node);
  });

  test("converges on the target markup", () => {
    const h = boot(page("<main><p>1</p><p>2</p><p>3</p></main>"));
    h.apply(page('<main><section><p>x</p></section><p>3</p></main>'));
    expect(h.doc.querySelector("main")!.innerHTML).toBe("<section><p>x</p></section><p>3</p>");
  });
});

describe("morph — preserves live state", () => {
  test("keeps an FAQ answer the user opened", () => {
    const h = boot(page("<main><details><summary>Q</summary>A</details></main>"));
    const details = h.doc.querySelector("details")!;
    details.setAttribute("open", "");
    h.apply(page("<main><details><summary>Q schimbat</summary>A</details></main>"));
    expect(h.doc.querySelector("details")!.hasAttribute("open")).toBe(true);
    expect(h.doc.querySelector("summary")!.textContent).toBe("Q schimbat");
  });

  test("keeps a closed FAQ answer closed", () => {
    const h = boot(page("<main><details><summary>Q</summary>A</details></main>"));
    h.apply(page("<main><details open><summary>Q</summary>A</details></main>"));
    expect(h.doc.querySelector("details")!.hasAttribute("open")).toBe(false);
  });

  test("leaves an open lightbox alone", () => {
    const h = boot(
      page(
        '<main></main><div data-sosb-lightbox hidden><img data-sosb-lightbox-img src="a.jpg"></div>',
      ),
    );
    const box = h.doc.querySelector("[data-sosb-lightbox]")!;
    box.removeAttribute("hidden");
    box.setAttribute("data-open", "true");
    box.querySelector("img")!.setAttribute("src", "chosen.jpg");

    h.apply(
      page(
        '<main><p>edit</p></main><div data-sosb-lightbox hidden><img data-sosb-lightbox-img src=""></div>',
      ),
    );

    expect(box.hasAttribute("hidden")).toBe(false);
    expect(box.getAttribute("data-open")).toBe("true");
    expect(box.querySelector("img")!.getAttribute("src")).toBe("chosen.jpg");
    // …while the rest of the page still updated.
    expect(h.doc.querySelector("main")!.textContent).toBe("edit");
  });

  test("restores scroll position when the morph disturbs it", () => {
    const h = boot(page("<main><p>1</p></main>"));
    const win = h.dom.window as unknown as Record<string, unknown>;
    const calls: [number, number][] = [];
    // jsdom never scrolls on its own, so simulate a browser that collapses
    // scroll to the top while the document is being patched: the first read
    // (the capture) sees the user's position, later reads see zero.
    let reads = 0;
    let y = 640;
    Object.defineProperty(win, "scrollY", {
      configurable: true,
      get: () => (reads++ === 0 ? y : 0),
    });
    Object.defineProperty(win, "scrollX", { configurable: true, get: () => 0 });
    win["scrollTo"] = (x: number, ny: number) => {
      calls.push([x, ny]);
      y = ny;
    };

    h.apply(page("<main><p>1</p><p>2</p></main>"));

    expect(calls).toEqual([[0, 640]]);
  });

  test("does not touch scroll when nothing disturbed it", () => {
    const h = boot(page("<main><p>1</p></main>"));
    const win = h.dom.window as unknown as Record<string, unknown>;
    const calls: unknown[] = [];
    Object.defineProperty(win, "scrollY", { configurable: true, get: () => 640 });
    Object.defineProperty(win, "scrollX", { configurable: true, get: () => 0 });
    win["scrollTo"] = (...args: unknown[]) => calls.push(args);

    h.apply(page("<main><p>1</p><p>2</p></main>"));

    expect(calls).toEqual([]);
  });

  test("keeps focus on an element that survived the morph", () => {
    const h = boot(page('<main><button id="b">x</button></main>'));
    const button = h.doc.querySelector("#b") as HTMLButtonElement;
    button.focus();
    expect(h.doc.activeElement).toBe(button);
    h.apply(page('<main><button id="b">y</button><p>new</p></main>'));
    expect(h.doc.activeElement).toBe(button);
  });
});

describe("morph — scripts are never re-run", () => {
  test("an unchanged script node is left untouched", () => {
    const h = boot(page('<main></main><script data-x="1">/*a*/</script>'));
    const script = h.doc.querySelector("script[data-x]");
    h.apply(page('<main><p>edit</p></main><script data-x="1">/*a*/</script>'));
    expect(h.doc.querySelector("script[data-x]")).toBe(script);
    expect(h.doc.querySelectorAll("script[data-x]")).toHaveLength(1);
  });

  test("the morph script itself is never duplicated when other scripts appear", () => {
    const morphTag = `<script ${PREVIEW_MORPH_SCRIPT_MARKER}>/*morph*/</script>`;
    const h = boot(page(`<main></main>${morphTag}`));
    h.apply(page(`<main></main><script data-sosb-lightbox-script>/*lb*/</script>${morphTag}`));
    expect(h.doc.querySelectorAll(`script[${PREVIEW_MORPH_SCRIPT_MARKER}]`)).toHaveLength(1);
    expect(h.doc.querySelectorAll("script[data-sosb-lightbox-script]")).toHaveLength(1);
  });

  test("a script is never removed, even when the new HTML drops it", () => {
    // Removing the bootstrap would not un-bind its listeners, so the morph
    // leaves it in place rather than pretending the removal took effect.
    const h = boot(page('<main></main><script data-sosb-lightbox-script>/*lb*/</script>'));
    h.apply(page("<main></main>"));
    expect(h.doc.querySelectorAll("script[data-sosb-lightbox-script]")).toHaveLength(1);
  });

  test("scripts do not desynchronise the positional walk of their siblings", () => {
    const h = boot(page('<nav>n</nav><script data-a>/*a*/</script><main>m</main>'));
    h.apply(page('<nav>N</nav><script data-a>/*a*/</script><main>M</main>'));
    expect(h.doc.querySelector("nav")!.textContent).toBe("N");
    expect(h.doc.querySelector("main")!.textContent).toBe("M");
    expect(h.doc.querySelectorAll("script")).toHaveLength(1);
  });
});

describe("morph — against real renderer output", () => {
  const faqSite = faqOnly as unknown as Site;
  const heroSite = heroOnly as unknown as Site;
  let base: string;

  beforeEach(() => {
    base = renderSite(faqSite, "academic", { mode: "preview" });
  });

  test("a typed edit converges on exactly what a full reload would have shown", () => {
    const h = boot(base);
    const edited = structuredClone(faqSite);
    edited.org.name = "HISTORIPOL editat";
    const target = renderSite(edited, "academic", { mode: "preview" });

    h.apply(target);

    // Compare against a document parsed from the target, ignoring the scripts
    // the morph deliberately leaves in place.
    const expectedDom = new JSDOM(target);
    const strip = (doc: Document): string => {
      for (const s of Array.from(doc.querySelectorAll("script"))) s.remove();
      return doc.body.innerHTML;
    };
    expect(strip(h.doc)).toBe(strip(expectedDom.window.document));
  });

  test("an open FAQ answer survives an edit to the surrounding page", () => {
    const h = boot(base);
    const details = h.doc.querySelector("details");
    expect(details).not.toBeNull();
    details!.setAttribute("open", "");

    const edited = structuredClone(faqSite);
    edited.org.name = "Nume nou";
    h.apply(renderSite(edited, "academic", { mode: "preview" }));

    expect(h.doc.querySelector("details")!.hasAttribute("open")).toBe(true);
  });

  test("morphing between two different pages still converges", () => {
    const h = boot(base);
    const target = renderSite(heroSite, "academic", { mode: "preview" });
    h.apply(target);
    expect(h.doc.querySelector("main")!.querySelector("details")).toBeNull();
    expect(h.doc.querySelectorAll("main > *").length).toBeGreaterThan(0);
  });
});
