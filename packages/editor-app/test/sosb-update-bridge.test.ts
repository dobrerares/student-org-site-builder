import { describe, expect, test, vi } from "vitest";
import { createSosbUpdateBridge, isElectronShellAvailable } from "../src/sosb-update-bridge.js";

/**
 * Adapter test: `createSosbUpdateBridge(window.sosb)` produces an
 * `UpdateBridge` for `<UpdateBanner>` to consume.
 *
 * The adapter has zero coupling to the IPC channel constants — it
 * receives a namespaced surface (`onUpdateEvent`, `installUpdateAndRelaunch`,
 * `declineUpdate`) and routes each banner event to the right channel
 * via the auto-update channel constants.
 */

interface FakeSosb {
  readonly onUpdateEvent: ReturnType<typeof vi.fn>;
  readonly installUpdateAndRelaunch: ReturnType<typeof vi.fn>;
  readonly declineUpdate: ReturnType<typeof vi.fn>;
  readonly checkForUpdates: ReturnType<typeof vi.fn>;
}

function fakeSosb(): FakeSosb & {
  fire: (channel: string, payload: unknown) => void;
  listeners: Map<string, Set<(payload: unknown) => void>>;
} {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  return {
    onUpdateEvent: vi.fn((channel: string, listener: (payload: unknown) => void) => {
      const set = listeners.get(channel) ?? new Set();
      set.add(listener);
      listeners.set(channel, set);
      return () => set.delete(listener);
    }),
    installUpdateAndRelaunch: vi.fn().mockResolvedValue(undefined),
    declineUpdate: vi.fn().mockResolvedValue(undefined),
    checkForUpdates: vi.fn().mockResolvedValue(undefined),
    fire: (channel, payload) => {
      for (const listener of listeners.get(channel) ?? []) listener(payload);
    },
    listeners,
  };
}

describe("createSosbUpdateBridge", () => {
  test("isElectronShellAvailable is true when window.sosb has the auto-update methods", () => {
    expect(isElectronShellAvailable(fakeSosb())).toBe(true);
  });

  test("isElectronShellAvailable is false when sosb is undefined", () => {
    expect(isElectronShellAvailable(undefined)).toBe(false);
  });

  test("isElectronShellAvailable is false when sosb is missing onUpdateEvent", () => {
    expect(isElectronShellAvailable({ installUpdateAndRelaunch: vi.fn() })).toBe(false);
  });

  test("onUpdateAvailable subscribes via sosb:update:available", () => {
    const sosb = fakeSosb();
    const bridge = createSosbUpdateBridge(sosb);
    const handler = vi.fn();
    bridge.onUpdateAvailable(handler);

    expect(sosb.onUpdateEvent).toHaveBeenCalledWith("sosb:update:available", expect.any(Function));

    sosb.fire("sosb:update:available", { version: "1.2.3" });
    expect(handler).toHaveBeenCalledWith({ version: "1.2.3" });
  });

  test("onUpdateDownloaded subscribes via sosb:update:downloaded", () => {
    const sosb = fakeSosb();
    const bridge = createSosbUpdateBridge(sosb);
    const handler = vi.fn();
    bridge.onUpdateDownloaded(handler);

    expect(sosb.onUpdateEvent).toHaveBeenCalledWith("sosb:update:downloaded", expect.any(Function));

    sosb.fire("sosb:update:downloaded", { version: "1.2.3" });
    expect(handler).toHaveBeenCalledWith({ version: "1.2.3" });
  });

  test("onUpdateError subscribes via sosb:update:error", () => {
    const sosb = fakeSosb();
    const bridge = createSosbUpdateBridge(sosb);
    const handler = vi.fn();
    bridge.onUpdateError(handler);

    expect(sosb.onUpdateEvent).toHaveBeenCalledWith("sosb:update:error", expect.any(Function));

    sosb.fire("sosb:update:error", { message: "boom" });
    expect(handler).toHaveBeenCalledWith({ message: "boom" });
  });

  test("installAndRelaunch routes to sosb.installUpdateAndRelaunch", async () => {
    const sosb = fakeSosb();
    const bridge = createSosbUpdateBridge(sosb);
    await bridge.installAndRelaunch();
    expect(sosb.installUpdateAndRelaunch).toHaveBeenCalledTimes(1);
  });

  test("declineUpdate routes to sosb.declineUpdate", async () => {
    const sosb = fakeSosb();
    const bridge = createSosbUpdateBridge(sosb);
    await bridge.declineUpdate();
    expect(sosb.declineUpdate).toHaveBeenCalledTimes(1);
  });
});
