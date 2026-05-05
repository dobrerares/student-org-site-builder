// @vitest-environment jsdom
import { describe, expect, test, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/preact";
import { UpdateBanner, type UpdateBridge } from "../src/update-banner.js";

/**
 * Preact's `useEffect` runs after render, so subscriptions registered
 * inside the banner aren't live until one microtask later. Flush them
 * by awaiting the next macrotask.
 */
async function flushEffects(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * AC (#36): the editor app surfaces auto-update lifecycle events as a
 * top-bar banner.
 *
 * - When the bridge fires `updateAvailable`, the banner shows
 *   "Update available" with a version label.
 * - When the bridge fires `updateDownloaded`, the banner switches to
 *   "Restart now / Later".
 *   - "Restart now" calls `bridge.installAndRelaunch()`.
 *   - "Later" calls `bridge.declineUpdate()` and dismisses the banner.
 * - When no event has fired the banner renders nothing.
 *
 * The banner has zero coupling to electron — it talks to a tiny
 * `UpdateBridge` shim. In the desktop shell the bridge is wired to
 * `window.sosb`; in tests we pass a fake.
 */

afterEach(() => {
  cleanup();
});

interface FakeBridge extends UpdateBridge {
  fireUpdateAvailable: (info: { version: string; releaseNotes?: string }) => void;
  fireUpdateDownloaded: (info: { version: string }) => void;
  fireUpdateError: (err: { message: string }) => void;
  installAndRelaunch: ReturnType<typeof vi.fn>;
  declineUpdate: ReturnType<typeof vi.fn>;
}

function fakeBridge(): FakeBridge {
  type Listener = (payload: unknown) => void;
  const listeners: Record<string, Listener[]> = {};

  const subscribe = (channel: string, listener: Listener): (() => void) => {
    (listeners[channel] ??= []).push(listener);
    return () => {
      listeners[channel] = (listeners[channel] ?? []).filter((l) => l !== listener);
    };
  };

  const fire = (channel: string, payload: unknown): void => {
    for (const listener of listeners[channel] ?? []) listener(payload);
  };

  return {
    onUpdateAvailable: (listener) => subscribe("updateAvailable", listener as Listener),
    onUpdateDownloaded: (listener) => subscribe("updateDownloaded", listener as Listener),
    onUpdateError: (listener) => subscribe("updateError", listener as Listener),
    installAndRelaunch: vi.fn().mockResolvedValue(undefined),
    declineUpdate: vi.fn().mockResolvedValue(undefined),
    fireUpdateAvailable: (info) => fire("updateAvailable", info),
    fireUpdateDownloaded: (info) => fire("updateDownloaded", info),
    fireUpdateError: (err) => fire("updateError", err),
  };
}

describe("<UpdateBanner>", () => {
  test("renders nothing when no update event has fired", async () => {
    const bridge = fakeBridge();
    const { container } = render(<UpdateBanner bridge={bridge} />);
    await flushEffects();
    expect(container.querySelector('[data-testid="update-banner"]')).toBeNull();
  });

  test("shows 'Update available' after updateAvailable fires", async () => {
    const bridge = fakeBridge();
    const { container } = render(<UpdateBanner bridge={bridge} />);
    await flushEffects();

    bridge.fireUpdateAvailable({ version: "1.2.3" });
    await flushEffects();

    const banner = container.querySelector('[data-testid="update-banner"]');
    expect(banner).not.toBeNull();
    expect(banner!.textContent).toContain("1.2.3");
    expect(banner!.textContent?.toLowerCase()).toContain("update");
  });

  test("'Restart now' button appears once update-downloaded fires", async () => {
    const bridge = fakeBridge();
    const { container } = render(<UpdateBanner bridge={bridge} />);
    await flushEffects();

    bridge.fireUpdateAvailable({ version: "1.2.3" });
    await flushEffects();
    bridge.fireUpdateDownloaded({ version: "1.2.3" });
    await flushEffects();

    const restart = container.querySelector('[data-testid="update-restart"]');
    expect(restart).not.toBeNull();
  });

  test("'Restart now' click invokes bridge.installAndRelaunch", async () => {
    const bridge = fakeBridge();
    const { container } = render(<UpdateBanner bridge={bridge} />);
    await flushEffects();

    bridge.fireUpdateAvailable({ version: "1.2.3" });
    await flushEffects();
    bridge.fireUpdateDownloaded({ version: "1.2.3" });
    await flushEffects();

    const restart = container.querySelector('[data-testid="update-restart"]') as HTMLButtonElement;
    fireEvent.click(restart);
    expect(bridge.installAndRelaunch).toHaveBeenCalledTimes(1);
  });

  test("'Later' click invokes bridge.declineUpdate and dismisses the banner", async () => {
    const bridge = fakeBridge();
    const { container } = render(<UpdateBanner bridge={bridge} />);
    await flushEffects();

    bridge.fireUpdateAvailable({ version: "1.2.3" });
    await flushEffects();

    const later = container.querySelector('[data-testid="update-later"]') as HTMLButtonElement;
    fireEvent.click(later);
    await flushEffects();

    expect(bridge.declineUpdate).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="update-banner"]')).toBeNull();
  });

  test("update errors render an error banner", async () => {
    const bridge = fakeBridge();
    const { container } = render(<UpdateBanner bridge={bridge} />);
    await flushEffects();

    bridge.fireUpdateError({ message: "network down" });
    await flushEffects();

    const banner = container.querySelector('[data-testid="update-banner-error"]');
    expect(banner).not.toBeNull();
    expect(banner!.textContent).toContain("network down");
  });
});
