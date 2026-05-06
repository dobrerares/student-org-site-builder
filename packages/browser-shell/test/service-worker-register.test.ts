import { describe, expect, test, vi } from "vitest";

import { registerServiceWorker } from "../src/service-worker/register.js";

/**
 * AC #1 — service worker registers and caches SPA on first load.
 * AC #2 — reload after fresh deploy fires the "new version" callback; user-
 *         triggered reload activates the new SPA.
 *
 * The PRD says (Updates & versioning, browser editor):
 *   "browser editor user — `new version available — reload to update` toast
 *    to appear when an update has been deployed".
 *
 * `registerServiceWorker(opts)` is the page-side helper that:
 *   1. Calls `navigator.serviceWorker.register(scriptUrl, { scope })`.
 *   2. Listens for `updatefound` on the registration; when the installing
 *      worker reaches the `installed` state behind an existing controller,
 *      fires `onUpdateAvailable()`.
 *   3. Returns a handle whose `applyUpdate()` posts `{ type: "SKIP_WAITING" }`
 *      to the waiting worker and then reloads the page.
 *
 * We don't test inside a real browser — that's the e2e's job. We pass a
 * fake `navigator.serviceWorker` so we can drive the lifecycle by hand.
 */

interface FakeWorker {
  state: ServiceWorkerState;
  postMessage(msg: unknown): void;
  addEventListener(type: "statechange", l: () => void): void;
}

interface FakeRegistration {
  active: FakeWorker | null;
  installing: FakeWorker | null;
  waiting: FakeWorker | null;
  addEventListener(type: "updatefound", l: () => void): void;
  // for tests
  __triggerUpdateFound(): void;
}

function makeFakeWorker(initial: ServiceWorkerState): FakeWorker & {
  __setState: (s: ServiceWorkerState) => void;
  __posted: unknown[];
} {
  const listeners = new Set<() => void>();
  const posted: unknown[] = [];
  let state = initial;
  return {
    get state(): ServiceWorkerState {
      return state;
    },
    set state(value: ServiceWorkerState) {
      state = value;
    },
    addEventListener(_type: "statechange", l: () => void): void {
      listeners.add(l);
    },
    postMessage(msg: unknown): void {
      posted.push(msg);
    },
    __setState(s: ServiceWorkerState): void {
      state = s;
      for (const l of listeners) l();
    },
    __posted: posted,
  };
}

function makeFakeRegistration(): FakeRegistration {
  const updateFoundListeners = new Set<() => void>();
  return {
    active: null,
    installing: null,
    waiting: null,
    addEventListener(_type: "updatefound", l: () => void): void {
      updateFoundListeners.add(l);
    },
    __triggerUpdateFound(): void {
      for (const l of updateFoundListeners) l();
    },
  };
}

function makeFakeNavigator(reg: FakeRegistration): {
  serviceWorker: {
    register: (url: string, opts?: { scope?: string }) => Promise<FakeRegistration>;
    __registeredWith: { url: string; opts: { scope?: string } | undefined };
  };
} {
  const captured = { url: "", opts: undefined as { scope?: string } | undefined };
  return {
    serviceWorker: {
      register: vi.fn(async (url: string, opts?: { scope?: string }) => {
        captured.url = url;
        captured.opts = opts;
        return reg;
      }),
      __registeredWith: captured,
    },
  };
}

describe("registerServiceWorker", () => {
  test("calls navigator.serviceWorker.register with the given URL and scope", async () => {
    const reg = makeFakeRegistration();
    const nav = makeFakeNavigator(reg);
    await registerServiceWorker({
      scriptUrl: "/sw.js",
      scope: "/",
      navigator: nav as unknown as Pick<Navigator, "serviceWorker">,
    });
    expect(nav.serviceWorker.register).toHaveBeenCalledTimes(1);
    expect(nav.serviceWorker.__registeredWith.url).toBe("/sw.js");
    expect(nav.serviceWorker.__registeredWith.opts?.scope).toBe("/");
  });

  test("does NOT fire onUpdateAvailable on first install (no prior controller)", async () => {
    const reg = makeFakeRegistration();
    const nav = makeFakeNavigator(reg);
    const onUpdateAvailable = vi.fn();
    await registerServiceWorker({
      scriptUrl: "/sw.js",
      onUpdateAvailable,
      navigator: nav as unknown as Pick<Navigator, "serviceWorker">,
    });

    // First install: no `active` worker, fresh `installing` worker reaches
    // `installed` then `activated`.
    const installing = makeFakeWorker("installing");
    reg.installing = installing as unknown as FakeWorker;
    reg.__triggerUpdateFound();
    installing.__setState("installed");

    expect(onUpdateAvailable).not.toHaveBeenCalled();
  });

  test("fires onUpdateAvailable when a new SW reaches 'installed' behind an existing controller", async () => {
    const reg = makeFakeRegistration();
    // Pretend a controller is already active (a previous deploy installed
    // a SW; this is the "post fresh deploy" path).
    const active = makeFakeWorker("activated");
    reg.active = active as unknown as FakeWorker;
    const nav = makeFakeNavigator(reg);
    const onUpdateAvailable = vi.fn();
    await registerServiceWorker({
      scriptUrl: "/sw.js",
      onUpdateAvailable,
      navigator: nav as unknown as Pick<Navigator, "serviceWorker">,
    });

    const installing = makeFakeWorker("installing");
    reg.installing = installing as unknown as FakeWorker;
    reg.__triggerUpdateFound();
    installing.__setState("installed");

    expect(onUpdateAvailable).toHaveBeenCalledTimes(1);
  });

  test("applyUpdate posts SKIP_WAITING to the waiting worker", async () => {
    const reg = makeFakeRegistration();
    const active = makeFakeWorker("activated");
    reg.active = active as unknown as FakeWorker;
    const nav = makeFakeNavigator(reg);
    const handle = await registerServiceWorker({
      scriptUrl: "/sw.js",
      navigator: nav as unknown as Pick<Navigator, "serviceWorker">,
    });

    const waiting = makeFakeWorker("installed");
    reg.waiting = waiting as unknown as FakeWorker;

    await handle.applyUpdate();

    expect(waiting.__posted).toEqual([{ type: "SKIP_WAITING" }]);
  });

  test("the returned handle exposes the underlying registration", async () => {
    const reg = makeFakeRegistration();
    const nav = makeFakeNavigator(reg);
    const handle = await registerServiceWorker({
      scriptUrl: "/sw.js",
      navigator: nav as unknown as Pick<Navigator, "serviceWorker">,
    });
    expect(handle.registration).toBe(reg);
  });

  test("rejects if navigator.serviceWorker is unavailable", async () => {
    await expect(
      registerServiceWorker({
        scriptUrl: "/sw.js",
        navigator: {} as Pick<Navigator, "serviceWorker">,
      }),
    ).rejects.toThrow(/serviceWorker/i);
  });
});
