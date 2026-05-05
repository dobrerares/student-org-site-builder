/**
 * Page-side helper that registers the service worker, watches for updates,
 * and exposes a handle the host UI can call to apply a pending update.
 *
 * Why a wrapper instead of letting the host call `navigator.serviceWorker
 * .register()` directly:
 *
 * 1. The "new version available" toast (PRD: "Versiune nouă disponibilă")
 *    is gated on a specific lifecycle moment — when a *new* SW reaches
 *    `installed` while the old SW is still controlling the page. Hand-
 *    rolling that detection in every host (browser shell, Electron embed)
 *    would duplicate the same fragile state machine.
 * 2. Tests need to inject a fake `navigator.serviceWorker`. A function-
 *    shaped helper accepts the navigator as a parameter and is trivially
 *    testable without a real browser.
 *
 * The protocol:
 *
 *   const handle = await registerServiceWorker({
 *     scriptUrl: "/sw.js",
 *     scope: "/",
 *     onUpdateAvailable: () => showToast("..."),
 *   });
 *
 *   // when the user clicks "Reload":
 *   await handle.applyUpdate();
 */

export interface ServiceWorkerRegistrationOptions {
  /** URL of the worker script (e.g. `/sw.js`). */
  readonly scriptUrl: string;
  /** Optional scope (defaults to the script's containing path). */
  readonly scope?: string;
  /**
   * Fires when a new SW reaches `installed` behind an active controller —
   * i.e. an update has been deployed and the page is ready to swap to it.
   *
   * Does NOT fire on first install (no prior controller means there's no
   * old version to displace; the user is on the fresh SW).
   */
  readonly onUpdateAvailable?: () => void;
  /**
   * Optional override for `navigator`. Defaults to `globalThis.navigator`.
   * Tests inject a fake.
   */
  readonly navigator?: Pick<Navigator, "serviceWorker">;
}

export interface ServiceWorkerHandle {
  /** The underlying browser registration object. */
  readonly registration: ServiceWorkerRegistration;
  /**
   * Tell the waiting worker to take control immediately. The worker
   * receives `{ type: "SKIP_WAITING" }` and calls `self.skipWaiting()`.
   *
   * Callers typically pair this with a `window.location.reload()` so the
   * fresh SPA bytes are loaded under the new controller.
   */
  applyUpdate(): Promise<void>;
}

/**
 * Register the SW. Resolves once the registration completes. The
 * `onUpdateAvailable` callback fires asynchronously when a new SW is
 * installed behind the active controller (i.e. after a deploy).
 */
export async function registerServiceWorker(
  options: ServiceWorkerRegistrationOptions,
): Promise<ServiceWorkerHandle> {
  const navigator = options.navigator ?? globalThis.navigator;
  if (
    navigator === undefined ||
    navigator === null ||
    !("serviceWorker" in navigator)
  ) {
    throw new Error(
      "registerServiceWorker: navigator.serviceWorker is unavailable. " +
        "The host must run inside a Window context with the Service Worker API.",
    );
  }

  const registerOptions: { scope?: string } = {};
  if (options.scope !== undefined) registerOptions.scope = options.scope;

  const registration = await navigator.serviceWorker.register(
    options.scriptUrl,
    registerOptions,
  );

  const onUpdateAvailable = options.onUpdateAvailable;
  if (onUpdateAvailable !== undefined) {
    // The first install (no prior controller) is NOT an "update". Capture
    // whether there was an active worker BEFORE we wire the listener.
    const hadController = registration.active !== null;
    registration.addEventListener("updatefound", () => {
      const installing = registration.installing;
      if (installing === null) return;
      const onStateChange = (): void => {
        if (installing.state === "installed" && hadController) {
          onUpdateAvailable();
        }
      };
      installing.addEventListener("statechange", onStateChange);
    });
  }

  return {
    registration,
    async applyUpdate(): Promise<void> {
      const waiting = registration.waiting;
      if (waiting === null) return;
      waiting.postMessage({ type: "SKIP_WAITING" });
    },
  };
}
