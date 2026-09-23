/**
 * The enforced sandbox (ADR 0046: "the builder must enforce these rendering
 * access limits rather than rely on extension authors to follow
 * documentation"; ADR 0054 for the mechanism).
 *
 * Every limit this file asserts is one a Theme author could otherwise reach
 * for in a moment of ordinary carelessness — `Date.now()` for a copyright
 * year, `fetch` for a logo, `setTimeout` for a "just once" hack. The point is
 * not that a hostile author cannot write them; it is that an *honest* author
 * cannot ship them by accident and discover the problem on a student's laptop
 * with no network.
 *
 * The escape tests deliberately probe through `typeof` rather than by calling,
 * because "absent" and "present but throws" are different guarantees and only
 * the first one is the one we promise.
 */

import { beforeAll, describe, expect, test } from "vitest";
import type { ThemeRenderHelpers } from "@sosb/renderer";
import { ThemeRenderError } from "@sosb/renderer";
import { compileThemeRenderModule, initThemeSandbox } from "../src/sandbox.js";

beforeAll(async () => {
  await initThemeSandbox();
}, 60_000);

/** Helpers that record nothing and answer predictably. */
const helpers: ThemeRenderHelpers = {
  asset: (path) => `assets/theme/org.example.sandbox/${path}`,
  mediaUrl: (ref) => (typeof ref === "string" ? ref : null),
  mediaAlt: () => "",
  pageUrl: (id) => `/${id}`,
  articleUrl: (id) => `/articles/${id}`,
  richText: () => ({ $sosbRichText: 0 }),
  t: (key) => `t:${key}`,
};

function design(body: string) {
  return compileThemeRenderModule("org.example.sandbox", body);
}

/** Compile a design whose `probe` Block returns the value of `expression`. */
function probe(expression: string): unknown {
  const module = design(
    `export default { blocks: { probe: () => ["p", null, String(${expression})] } }`,
  );
  try {
    return module.renderBlock("probe", {}, helpers);
  } finally {
    module.dispose();
  }
}

describe("what a design can reach", () => {
  test.each([
    ["fetch", "typeof fetch"],
    ["XMLHttpRequest", "typeof XMLHttpRequest"],
    ["setTimeout", "typeof setTimeout"],
    ["setInterval", "typeof setInterval"],
    ["queueMicrotask", "typeof queueMicrotask"],
    ["require", "typeof require"],
    ["process", "typeof process"],
    ["WebAssembly", "typeof WebAssembly"],
    ["console", "typeof console"],
    ["performance", "typeof performance"],
    ["Intl", "typeof Intl"],
    ["Date", "typeof Date"],
    ["Math.random", "typeof Math.random"],
    ["WeakRef", "typeof WeakRef"],
    ["FinalizationRegistry", "typeof FinalizationRegistry"],
    // QuickJS's own host bindings, which would be a filesystem if present.
    ["std", "typeof std"],
    ["os", "typeof os"],
    ["scriptArgs", "typeof scriptArgs"],
  ])("%s is absent from the render realm", (_name, expression) => {
    expect(probe(expression)).toEqual(["p", null, "undefined"]);
  });

  test("the realm's globalThis is not the builder's", () => {
    // A design *can* reach its own global object — there is nothing to hide
    // there. What matters is that it is a different realm, so nothing the
    // builder holds is on it. `window` and `global` are the two names host
    // code would answer to.
    expect(probe("typeof globalThis.window")).toEqual(["p", null, "undefined"]);
    expect(probe("typeof globalThis.global")).toEqual(["p", null, "undefined"]);
    expect(probe("typeof new Function('return this')().fetch")).toEqual(["p", null, "undefined"]);
  });

  test("a static import fails to load the module at all", () => {
    expect(() => design(`import "./other.js"; export default { blocks: {} }`)).toThrow(
      /could not load module|may not import/i,
    );
  });

  test("a dynamic import never resolves, so it cannot smuggle code in", () => {
    // The promise stays pending: there is no module loader and rendering is
    // synchronous, so the design gets a Promise it can never observe.
    expect(probe("typeof import('./other.js').then")).toEqual(["p", null, "function"]);
    const module = design(`export default { blocks: { probe: () => import("./x.js") } }`);
    try {
      // JSON round-tripping a pending Promise yields an empty object, which
      // the tree validator rejects downstream. It is never module contents.
      expect(module.renderBlock("probe", {}, helpers)).toEqual({});
    } finally {
      module.dispose();
    }
  });

  test('helpers that can answer null do answer null, not the string "null"', () => {
    const module = design(
      `export default { blocks: { probe: (i) => ["p", { "data-m": String(i.mediaUrl(undefined)), "data-p": String(i.pageUrl("x")), "data-a": String(i.articleUrl("y")) }, String(i.mediaUrl("assets/a.jpg"))] } }`,
    );
    try {
      expect(module.renderBlock("probe", {}, helpers)).toEqual([
        "p",
        { "data-m": "null", "data-p": "/x", "data-a": "/articles/y" },
        "assets/a.jpg",
      ]);
    } finally {
      module.dispose();
    }
  });

  test("a host helper is the only way out, and it is a plain string", () => {
    const module = design(
      `export default { blocks: { probe: (i) => ["img", { src: i.asset("a.svg") }] } }`,
    );
    try {
      expect(module.renderBlock("probe", {}, helpers)).toEqual([
        "img",
        { src: "assets/theme/org.example.sandbox/a.svg" },
      ]);
    } finally {
      module.dispose();
    }
  });
});

describe("failure is loud and attributable", () => {
  test("a design that throws raises a ThemeRenderError naming the Theme", () => {
    const module = design(
      `export default { blocks: { probe: () => { throw new Error("kaput") } } }`,
    );
    try {
      expect(() => module.renderBlock("probe", {}, helpers)).toThrow(ThemeRenderError);
      try {
        module.renderBlock("probe", {}, helpers);
      } catch (error) {
        expect(error).toBeInstanceOf(ThemeRenderError);
        expect((error as ThemeRenderError).code).toBe("threw");
        expect((error as ThemeRenderError).themeId).toBe("org.example.sandbox");
        expect((error as ThemeRenderError).message).toContain("kaput");
      }
    } finally {
      module.dispose();
    }
  });

  test("a runaway loop is interrupted rather than hanging the builder", () => {
    const module = design(`export default { blocks: { probe: () => { while (true) {} } } }`);
    try {
      try {
        module.renderBlock("probe", {}, helpers);
        throw new Error("expected the budget to be exhausted");
      } catch (error) {
        expect(error).toBeInstanceOf(ThemeRenderError);
        expect((error as ThemeRenderError).code).toBe("timeout");
        expect((error as ThemeRenderError).message).toMatch(/instruction budget/);
      }
    } finally {
      module.dispose();
    }
  }, 30_000);

  test("an allocation that never stops hits the heap ceiling, loudly", () => {
    // Each iteration keeps ~1 KB alive, so the 48 MB ceiling arrives long
    // before the instruction budget would — this is the memory failure, not
    // the loop failure, and the author is told which. Small allocations on
    // purpose: the ceiling is checked every ten thousand operations, and a
    // test that overshoots by hundreds of megabytes is a test that gets the
    // runner killed on a small machine.
    const module = design(
      `export default { blocks: { probe: () => { const keep = []; for (;;) keep.push(new Array(64).fill("x")); } } }`,
    );
    try {
      try {
        module.renderBlock("probe", {}, helpers);
        throw new Error("expected the heap ceiling to be hit");
      } catch (error) {
        expect(error).toBeInstanceOf(ThemeRenderError);
        expect((error as ThemeRenderError).code).toBe("memory");
        expect((error as ThemeRenderError).message).toMatch(/memory limit/);
      }
    } finally {
      module.dispose();
    }
  }, 60_000);

  test("one oversized allocation is refused by the engine itself", () => {
    const module = design(
      `export default { blocks: { probe: () => { const big = new Uint8Array(256 * 1024 * 1024); return ["p", null, String(big.length)]; } } }`,
    );
    try {
      try {
        module.renderBlock("probe", {}, helpers);
        throw new Error("expected the allocation to be refused");
      } catch (error) {
        expect(error).toBeInstanceOf(ThemeRenderError);
        expect((error as ThemeRenderError).code).toBe("memory");
      }
    } finally {
      module.dispose();
    }
  });

  test("unbounded recursion is an error in the design's realm, not a crash", () => {
    const module = design(
      `export default { blocks: { probe: () => { const f = (n) => f(n + 1) + 1; return f(0); } } }`,
    );
    try {
      try {
        module.renderBlock("probe", {}, helpers);
        throw new Error("expected a stack overflow");
      } catch (error) {
        expect(error).toBeInstanceOf(ThemeRenderError);
        expect((error as ThemeRenderError).code).toBe("threw");
        expect((error as ThemeRenderError).message).toMatch(/stack overflow/i);
      }
    } finally {
      module.dispose();
    }
  });

  test("the realm survives its own failures: the next call renders normally", () => {
    const module = design(`export default {
      blocks: {
        hungry: () => { const keep = []; for (;;) keep.push(new Array(64).fill("x")); },
        fine: () => ["p", null, "still here"],
      },
    }`);
    try {
      expect(() => module.renderBlock("hungry", {}, helpers)).toThrow(ThemeRenderError);
      expect(module.renderBlock("fine", {}, helpers)).toEqual(["p", null, "still here"]);
    } finally {
      module.dispose();
    }
  }, 60_000);

  test("the budget is per call, so one runaway Block does not poison the next", () => {
    const module = design(`export default {
      blocks: {
        slow: () => { while (true) {} },
        fine: () => ["p", null, "ok"],
      },
    }`);
    try {
      expect(() => module.renderBlock("slow", {}, helpers)).toThrow(ThemeRenderError);
      expect(module.renderBlock("fine", {}, helpers)).toEqual(["p", null, "ok"]);
    } finally {
      module.dispose();
    }
  }, 30_000);

  test("a module with no default export is rejected at compile time", () => {
    expect(() => design(`export const blocks = {}`)).toThrow(/export default/);
  });

  test("a module with a syntax error is rejected at compile time", () => {
    expect(() => design(`export default { blocks: { `)).toThrow(ThemeRenderError);
  });

  test("a cyclic return value is a rendering failure, not a hang", () => {
    const module = design(
      `export default { blocks: { probe: () => { const a = ["div", null]; a.push(a); return a } } }`,
    );
    try {
      expect(() => module.renderBlock("probe", {}, helpers)).toThrow(ThemeRenderError);
    } finally {
      module.dispose();
    }
  });
});

describe("determinism", () => {
  test("two designs cannot see each other's globals", () => {
    const first = design(`globalThis.leaked = "one"; export default { blocks: {} }`);
    const second = design(
      `export default { blocks: { probe: () => ["p", null, String(globalThis.leaked)] } }`,
    );
    try {
      expect(second.renderBlock("probe", {}, helpers)).toEqual(["p", null, "undefined"]);
    } finally {
      first.dispose();
      second.dispose();
    }
  });

  test("the same input renders the same tree, call after call", () => {
    const module = design(`export default {
      blocks: { probe: (i) => ["p", { class: "x" }, i.data.title] },
    }`);
    try {
      const input = { data: { title: "Hello" } };
      const runs = [0, 1, 2, 3, 4].map(() =>
        JSON.stringify(module.renderBlock("probe", input, helpers)),
      );
      expect(new Set(runs).size).toBe(1);
    } finally {
      module.dispose();
    }
  });

  test("a design sees only what it was given", () => {
    const module = design(`export default {
      blocks: { probe: (i) => ["p", null, Object.keys(i).sort().join(",")] },
    }`);
    try {
      const tree = module.renderBlock("probe", { id: "b1", type: "hero", data: {} }, helpers);
      expect(tree).toEqual([
        "p",
        null,
        "articleUrl,asset,data,id,mediaAlt,mediaUrl,pageUrl,richText,t,type",
      ]);
    } finally {
      module.dispose();
    }
  });

  test("blockTypes reports only the functions the design actually supplies", () => {
    const module = design(`export default {
      blocks: { zebra: () => null, hero: () => null, notAFunction: 3 },
      shell: () => ["div", null, ["slot"]],
    }`);
    try {
      expect(module.blockTypes).toEqual(["hero", "zebra"]);
      expect(module.hasShell).toBe(true);
    } finally {
      module.dispose();
    }
  });
});
