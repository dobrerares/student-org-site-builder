import { describe, expect, test, vi } from "vitest";
import type { Site } from "@sosb/schema";

import {
  PREVIEW_BRIDGE_VERSION,
  decodeHostMessage,
  decodePreviewMessage,
  encodeHostMessage,
  encodePreviewMessage,
  type HostMessage,
  type PreviewMessage,
} from "../src/index.js";

const sampleSite = {
  schemaVersion: 1,
  org: { name: "X" },
  theme: { id: "stub" },
  defaultLanguage: "ro",
  languages: ["ro"],
  pages: [],
} as unknown as Site;

describe("preview-bridge protocol", () => {
  test("encoded host messages carry a stable channel + version", () => {
    const msg: HostMessage = {
      type: "siteData",
      siteData: sampleSite,
      themeId: "stub",
    };
    const encoded = encodeHostMessage(msg);
    expect(encoded.channel).toBe("sosb:preview");
    expect(encoded.version).toBe(PREVIEW_BRIDGE_VERSION);
    expect(encoded.payload.type).toBe("siteData");
  });

  test("encoded preview messages carry the same channel + version", () => {
    const msg: PreviewMessage = { type: "ready" };
    const encoded = encodePreviewMessage(msg);
    expect(encoded.channel).toBe("sosb:preview");
    expect(encoded.version).toBe(PREVIEW_BRIDGE_VERSION);
    expect(encoded.payload.type).toBe("ready");
  });

  test("decodeHostMessage rejects payloads from a different channel", () => {
    expect(
      decodeHostMessage({ channel: "other", version: 1, payload: { type: "siteData" } }),
    ).toBeNull();
    expect(decodeHostMessage(null)).toBeNull();
    expect(decodeHostMessage("not an envelope")).toBeNull();
  });

  test("decodeHostMessage rejects payloads from a future protocol version", () => {
    const future = {
      channel: "sosb:preview",
      version: PREVIEW_BRIDGE_VERSION + 1,
      payload: { type: "siteData", siteData: sampleSite, themeId: "stub" },
    };
    expect(decodeHostMessage(future)).toBeNull();
  });

  test("decodeHostMessage round-trips a siteData message", () => {
    const original: HostMessage = {
      type: "siteData",
      siteData: sampleSite,
      themeId: "stub",
      pageIndex: 0,
    };
    const decoded = decodeHostMessage(encodeHostMessage(original));
    expect(decoded).toEqual(original);
  });

  test("decodePreviewMessage round-trips ready and error events", () => {
    const ready = decodePreviewMessage(encodePreviewMessage({ type: "ready" }));
    expect(ready).toEqual({ type: "ready" });
    const err = decodePreviewMessage(encodePreviewMessage({ type: "error", message: "boom" }));
    expect(err).toEqual({ type: "error", message: "boom" });
  });

  test("decodePreviewMessage round-trips a navigate event", () => {
    const nav = decodePreviewMessage(
      encodePreviewMessage({ type: "navigate", path: "/about/" }),
    );
    expect(nav).toEqual({ type: "navigate", path: "/about/" });
  });

  test("decodePreviewMessage rejects a navigate event with a missing path", () => {
    expect(
      decodePreviewMessage({
        channel: "sosb:preview",
        version: 1,
        payload: { type: "navigate" },
      }),
    ).toBeNull();
  });

  test("decodePreviewMessage rejects malformed payloads", () => {
    expect(decodePreviewMessage(undefined)).toBeNull();
    expect(decodePreviewMessage({})).toBeNull();
    expect(
      decodePreviewMessage({ channel: "sosb:preview", version: 1, payload: { type: "wat" } }),
    ).toBeNull();
  });
});

describe("createPreviewHost", () => {
  test("postSiteData posts an encoded host message to the iframe contentWindow", async () => {
    const { createPreviewHost } = await import("../src/index.js");
    const posted: unknown[] = [];
    const fakeIframe = {
      contentWindow: {
        postMessage: (data: unknown) => {
          posted.push(data);
        },
      },
    };
    const host = createPreviewHost({
      iframe: fakeIframe as unknown as HTMLIFrameElement,
    });
    host.postSiteData(sampleSite, "stub");

    expect(posted).toHaveLength(1);
    const decoded = decodeHostMessage(posted[0]);
    expect(decoded?.type).toBe("siteData");
  });

  test("onPreviewEvent fires when the iframe posts back a ready message", async () => {
    const { createPreviewHost } = await import("../src/index.js");
    const handler = vi.fn();
    const host = createPreviewHost({
      iframe: {} as HTMLIFrameElement,
      onPreviewEvent: handler,
    });

    // Simulate the iframe posting back into the editor host.
    host.handleIncomingMessage(encodePreviewMessage({ type: "ready" }));

    expect(handler).toHaveBeenCalledWith({ type: "ready" });
  });

  test("onPreviewEvent ignores noise from other channels", async () => {
    const { createPreviewHost } = await import("../src/index.js");
    const handler = vi.fn();
    const host = createPreviewHost({
      iframe: {} as HTMLIFrameElement,
      onPreviewEvent: handler,
    });

    host.handleIncomingMessage({ channel: "other", version: 1, payload: {} });
    host.handleIncomingMessage("plain string");
    host.handleIncomingMessage(null);

    expect(handler).not.toHaveBeenCalled();
  });
});
