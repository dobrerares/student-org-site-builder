/**
 * The enforced sandbox for a Theme's `render.js` (ADR 0053).
 *
 * ADR 0046 does not merely ask Theme authors to stay offline during a render —
 * it says "the builder must enforce these rendering access limits rather than
 * rely on extension authors to follow documentation". A `new Function(source)`
 * in the host realm cannot do that: `fetch`, `Date`, `Math.random`,
 * `setTimeout` and `globalThis` are all one identifier away, and no amount of
 * deleting them from a `with` scope survives contact with a determined author,
 * let alone a copy-pasted npm snippet.
 *
 * So a Theme's code runs in **QuickJS compiled to WebAssembly**
 * (`quickjs-emscripten`), in a separate realm with its own heap. The host
 * realm is not reachable from inside; the only things that are reachable are
 * the handful of functions this module installs. `fetch`, `XMLHttpRequest`,
 * `setTimeout`, `require`, `process`, `WebAssembly`, `console` and `Intl` are
 * simply *absent* from that realm — not shadowed, not proxied — and `Date`,
 * `Math.random`, `WeakRef` and `FinalizationRegistry` are deleted by the
 * bootstrap because QuickJS does ship those and all four would make a render
 * a function of something other than the Site.
 *
 * Three properties the design turns on:
 *
 *  - **One asynchronous step, at load time.** Instantiating the WASM module is
 *    a promise; everything after it is synchronous. `renderSite` and `build()`
 *    stay synchronous (ADR 0052) and the editor's `srcdoc` preview keeps
 *    working. `initThemeSandbox()` is the one `await`, and it belongs where
 *    the I/O already is.
 *  - **A deterministic budget, not a clock.** The runaway-loop guard counts
 *    interrupt-handler invocations rather than milliseconds. A wall-clock
 *    timeout would make "does this Theme render?" depend on how busy the
 *    machine is, which is precisely the environment dependence ADR 0032
 *    forbids.
 *  - **Data across the boundary, never code.** Input goes in as JSON and trees
 *    come back as JSON. A guest value can therefore never be a host object, a
 *    host function, or a reference to anything the host holds.
 */

import { newQuickJSWASMModuleFromVariant } from "quickjs-emscripten-core";
import type { QuickJSContext, QuickJSHandle, QuickJSWASMModule } from "quickjs-emscripten-core";
import releaseSyncVariant from "@jitl/quickjs-singlefile-browser-release-sync";
import type { ThemeRenderHelpers, ThemeRenderModule } from "@sosb/renderer";
import { ThemeRenderError } from "@sosb/renderer";

/**
 * Per-Theme heap ceiling.
 *
 * Generous for a design that builds element trees, and small enough that a
 * Theme which tries to allocate its way through the editor's memory fails
 * loudly in its own realm instead of taking the tab down with it.
 */
const MEMORY_LIMIT_BYTES = 48 * 1024 * 1024;

/** Guest stack ceiling. A runaway recursion becomes an error, not a crash. */
const STACK_SIZE_BYTES = 1024 * 1024;

/**
 * Interrupt-handler invocations one design call may spend.
 *
 * QuickJS polls the handler every few thousand bytecode operations, so this is
 * an instruction budget with a fuzzy unit — deterministic for a given QuickJS
 * build, which is the property that matters, and orders of magnitude more than
 * building a page's worth of element trees needs.
 */
const CALL_BUDGET = 250_000;

/** Bytes of `render.js` we will accept. A design is code, not a payload. */
export const RENDER_MODULE_MAX_BYTES = 512 * 1024;

/**
 * The guest-side bootstrap.
 *
 * Runs before the Theme's module and does three jobs: remove the
 * non-deterministic globals QuickJS ships, define the marshalling entry points
 * the host calls, and make the helper closures that a design sees on its
 * `input`.
 *
 * Note what is *not* here: no attempt to freeze the realm or to defend the
 * host from the guest. There is nothing of the host's in this realm to defend.
 */
const GUEST_BOOTSTRAP = `
(function () {
  // Determinism (ADR 0032). QuickJS has no clock of its own for Date to read
  // beyond the host's, and Math.random is seeded unpredictably; a design that
  // reached for either would render a different page every time.
  delete globalThis.Date;
  delete Math.random;
  // GC-observable objects: a design could branch on whether a value had been
  // collected, which is neither deterministic nor useful here.
  delete globalThis.WeakRef;
  delete globalThis.FinalizationRegistry;

  var design = null;

  function attach(input) {
    input.asset = function (p) { return __sosb_asset(String(p)); };
    input.mediaUrl = function (r) { return __sosb_mediaUrl(JSON.stringify(r === undefined ? null : r)); };
    input.mediaAlt = function (r) { return __sosb_mediaAlt(JSON.stringify(r === undefined ? null : r)); };
    input.pageUrl = function (id) { return __sosb_pageUrl(String(id)); };
    input.articleUrl = function (id) { return __sosb_articleUrl(String(id)); };
    input.richText = function (doc) {
      return JSON.parse(__sosb_richText(JSON.stringify(doc === undefined ? null : doc)));
    };
    input.t = function (k) { return __sosb_t(String(k)); };
    return input;
  }

  // JSON.stringify returns undefined for a function or a bare undefined, and
  // throws on a cycle. Both are the design's mistake and both have to reach
  // the host as something it can report, so normalise the first and let the
  // second propagate as a guest exception.
  function pack(value) {
    var json = JSON.stringify(value);
    return typeof json === "string" ? json : "null";
  }

  globalThis.__sosb = {
    install: function (module) {
      var d = module && module.default;
      if (d === null || typeof d !== "object") {
        throw new Error("render.js must 'export default' an object with a 'blocks' map.");
      }
      design = d;
      var types = [];
      if (d.blocks !== null && typeof d.blocks === "object") {
        for (var key in d.blocks) {
          if (Object.prototype.hasOwnProperty.call(d.blocks, key) && typeof d.blocks[key] === "function") {
            types.push(key);
          }
        }
      }
      types.sort();
      return JSON.stringify({ blockTypes: types, hasShell: typeof d.shell === "function" });
    },
    block: function (type, json) {
      return pack(design.blocks[type](attach(JSON.parse(json))));
    },
    shell: function (json) {
      return pack(design.shell(attach(JSON.parse(json))));
    },
  };
})();
`;

let modulePromise: Promise<QuickJSWASMModule> | undefined;
let wasmModule: QuickJSWASMModule | undefined;

/**
 * Instantiate the sandbox engine. Idempotent, and the only `await` in the
 * Theme-loading path.
 *
 * The three asynchronous package entry points (`loadThemePackageFromZip`,
 * `…FromVfs`, `…FromDirectory` in Node) call this themselves, so a caller only
 * needs it when loading from a bare `path -> bytes` map synchronously.
 */
export async function initThemeSandbox(): Promise<void> {
  if (wasmModule !== undefined) return;
  modulePromise ??= newQuickJSWASMModuleFromVariant(releaseSyncVariant);
  wasmModule = await modulePromise;
}

/** Is the engine ready for a synchronous `loadThemePackage`? */
export function themeSandboxReady(): boolean {
  return wasmModule !== undefined;
}

/**
 * Raised when a package ships `render.js` but the engine was never started.
 *
 * Deliberately loud. The quiet alternative — load the package without its
 * design — produces a Site that renders with built-in Block markup under a
 * Theme whose CSS was written for something else, which looks broken in a way
 * nobody can trace back to a missing `await`.
 */
export class ThemeSandboxNotReadyError extends Error {
  public override readonly name = "ThemeSandboxNotReadyError";
  constructor() {
    super(
      "This Theme package contains render.js, but the Theme sandbox has not been started. " +
        "Call `await initThemeSandbox()` before loading it synchronously.",
    );
  }
}

/**
 * Turn whatever the guest threw into a `ThemeRenderError`.
 *
 * An interrupted call and a thrown exception are indistinguishable at the FFI
 * level — both come back as an error result — so the budget is consulted to
 * tell "ran too long" from "threw", which are very different things for the
 * author reading the message.
 */
function guestError(
  context: QuickJSContext,
  handle: QuickJSHandle,
  themeId: string,
  subject: string,
  blockType: string | undefined,
  exhausted: boolean,
): ThemeRenderError {
  let detail: string;
  try {
    const dumped = context.dump(handle) as { message?: unknown; name?: unknown } | string;
    detail =
      typeof dumped === "string"
        ? dumped
        : typeof dumped?.message === "string"
          ? `${typeof dumped.name === "string" ? dumped.name : "Error"}: ${dumped.message}`
          : "the design threw a value that is not an Error";
  } catch {
    detail = "the design threw a value the builder could not read";
  } finally {
    handle.dispose();
  }
  if (exhausted) {
    return new ThemeRenderError({
      code: "timeout",
      themeId,
      subject,
      blockType,
      detail: `the design ran past its instruction budget (${CALL_BUDGET}). A loop is probably not terminating.`,
    });
  }
  return new ThemeRenderError({ code: "threw", themeId, subject, blockType, detail });
}

/**
 * Compile a Theme's `render.js` into a synchronous `ThemeRenderModule`.
 *
 * One QuickJS runtime and context per Theme, created here and disposed by
 * `dispose()`. Per-Theme rather than per-render because compiling the module
 * on every Block would dominate the render, and per-Theme rather than global
 * because two Themes sharing a realm could see each other's globals.
 */
export function compileThemeRenderModule(themeId: string, source: string): ThemeRenderModule {
  if (wasmModule === undefined) throw new ThemeSandboxNotReadyError();

  const runtime = wasmModule.newRuntime();
  runtime.setMemoryLimit(MEMORY_LIMIT_BYTES);
  runtime.setMaxStackSize(STACK_SIZE_BYTES);
  // No module loader: a static `import` fails at evaluation with a named
  // error, and a dynamic `import()` returns a promise that never settles.
  // Either way a design cannot pull in code the builder never validated.
  runtime.setModuleLoader(() => {
    throw new Error("render.js may not import other modules; a Theme package ships one design file.");
  });

  let budget = CALL_BUDGET;
  let exhausted = false;
  runtime.setInterruptHandler(() => {
    if (--budget > 0) return false;
    exhausted = true;
    return true;
  });

  const context = runtime.newContext();
  let api: QuickJSHandle | undefined;
  let disposed = false;

  /** Helpers for the call currently in flight. Swapped before each call. */
  let active: ThemeRenderHelpers | undefined;

  function disposeAll(): void {
    if (disposed) return;
    disposed = true;
    api?.dispose();
    context.dispose();
    runtime.dispose();
  }

  /** Install one host function on the guest global. */
  function hostFn(name: string, impl: (arg: string) => string): void {
    const fn = context.newFunction(name, (argHandle) => {
      const arg = context.getString(argHandle);
      return context.newString(impl(arg));
    });
    context.setProp(context.global, name, fn);
    fn.dispose();
  }

  function requireActive(): ThemeRenderHelpers {
    if (active === undefined) throw new Error("a Theme helper was called outside a render.");
    return active;
  }

  hostFn("__sosb_asset", (path) => requireActive().asset(path));
  hostFn("__sosb_mediaUrl", (json) => JSON.stringify(requireActive().mediaUrl(safeParse(json))));
  hostFn("__sosb_mediaAlt", (json) => requireActive().mediaAlt(safeParse(json)));
  hostFn("__sosb_pageUrl", (id) => JSON.stringify(requireActive().pageUrl(id)));
  hostFn("__sosb_articleUrl", (id) => JSON.stringify(requireActive().articleUrl(id)));
  hostFn("__sosb_richText", (json) => JSON.stringify(requireActive().richText(safeParse(json))));
  hostFn("__sosb_t", (key) => requireActive().t(key));

  const moduleInvalid = (detail: string): ThemeRenderError => {
    disposeAll();
    return new ThemeRenderError({ code: "module-invalid", themeId, subject: "render.js", detail });
  };

  const boot = context.evalCode(GUEST_BOOTSTRAP, "sosb-bootstrap.js");
  if (boot.error !== undefined) {
    boot.error.dispose();
    throw moduleInvalid("the builder's sandbox bootstrap failed to evaluate.");
  }
  boot.value.dispose();

  const evaluated = context.evalCode(source, "render.js", { type: "module" });
  if (evaluated.error !== undefined) {
    throw moduleInvalid(
      guestError(context, evaluated.error, themeId, "render.js", undefined, exhausted).detail,
    );
  }
  const namespace = evaluated.value;

  api = context.getProp(context.global, "__sosb");
  const install = context.getProp(api, "install");
  const installed = context.callFunction(install, api, namespace);
  install.dispose();
  namespace.dispose();
  if (installed.error !== undefined) {
    throw moduleInvalid(
      guestError(context, installed.error, themeId, "render.js", undefined, exhausted).detail,
    );
  }
  const summary = JSON.parse(context.getString(installed.value)) as {
    blockTypes: string[];
    hasShell: boolean;
  };
  installed.value.dispose();

  function invoke(
    method: "block" | "shell",
    args: readonly string[],
    input: unknown,
    helpers: ThemeRenderHelpers,
    subject: string,
    blockType: string | undefined,
  ): unknown {
    if (disposed) {
      throw new ThemeRenderError({
        code: "threw",
        themeId,
        subject,
        blockType,
        detail: "this Theme's design has already been released.",
      });
    }
    budget = CALL_BUDGET;
    exhausted = false;
    active = helpers;
    const argHandles: QuickJSHandle[] = [];
    try {
      for (const arg of args) argHandles.push(context.newString(arg));
      argHandles.push(context.newString(JSON.stringify(input)));
      const fn = context.getProp(api!, method);
      const result = context.callFunction(fn, api!, ...argHandles);
      fn.dispose();
      if (result.error !== undefined) {
        throw guestError(context, result.error, themeId, subject, blockType, exhausted);
      }
      const json = context.getString(result.value);
      result.value.dispose();
      return JSON.parse(json);
    } finally {
      for (const handle of argHandles) handle.dispose();
      active = undefined;
    }
  }

  return {
    blockTypes: summary.blockTypes,
    hasShell: summary.hasShell,
    renderBlock(blockType, input, helpers) {
      return invoke("block", [blockType], input, helpers, "block", blockType);
    },
    renderShell(input, helpers) {
      return invoke("shell", [], input, helpers, "shell", undefined);
    },
    dispose: disposeAll,
  };
}

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
