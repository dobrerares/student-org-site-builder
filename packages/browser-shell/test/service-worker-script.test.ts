import { describe, expect, test } from "vitest";

import { buildServiceWorkerScript } from "../src/service-worker/script.js";

/**
 * AC #1 + AC #5 — the service worker caches the SPA assets on install and
 * serves them from cache when offline. The script generator produces the
 * worker source as a string so the host (a build pipeline, an Electron
 * shell, or the dev harness) can write it to disk and serve it under a
 * known URL.
 *
 * We test the *shape* of the generated script — not that it executes
 * inside a real ServiceWorkerGlobalScope (the e2e covers that). The shape
 * tests catch regressions where the script forgets to precache an asset,
 * forgets to bump cache names on version change, or removes the
 * skipWaiting/clients.claim pattern that the host relies on.
 */
describe("buildServiceWorkerScript", () => {
  test("returns a non-empty string", () => {
    const script = buildServiceWorkerScript({
      version: "v1",
      precacheUrls: ["/", "/app.js"],
    });
    expect(typeof script).toBe("string");
    expect(script.length).toBeGreaterThan(100);
  });

  test("embeds the version into the cache name so a version bump invalidates the old cache", () => {
    const a = buildServiceWorkerScript({
      version: "v1",
      precacheUrls: ["/"],
    });
    const b = buildServiceWorkerScript({
      version: "v2",
      precacheUrls: ["/"],
    });
    expect(a).toContain("v1");
    expect(b).toContain("v2");
    expect(a).not.toBe(b);
  });

  test("embeds every precache URL into the script literally", () => {
    const script = buildServiceWorkerScript({
      version: "v1",
      precacheUrls: ["/", "/app.js", "/styles/main.css", "/assets/logo.svg"],
    });
    expect(script).toContain("/app.js");
    expect(script).toContain("/styles/main.css");
    expect(script).toContain("/assets/logo.svg");
    expect(script).toContain('"/"');
  });

  test("registers the install + activate + fetch handlers", () => {
    const script = buildServiceWorkerScript({
      version: "v1",
      precacheUrls: ["/"],
    });
    expect(script).toMatch(/addEventListener\(\s*['"]install['"]/);
    expect(script).toMatch(/addEventListener\(\s*['"]activate['"]/);
    expect(script).toMatch(/addEventListener\(\s*['"]fetch['"]/);
  });

  test("calls cache.addAll(precacheUrls) on install", () => {
    const script = buildServiceWorkerScript({
      version: "v1",
      precacheUrls: ["/", "/app.js"],
    });
    expect(script).toContain("addAll");
  });

  test("calls clients.claim() on activate so the new worker controls open pages immediately", () => {
    const script = buildServiceWorkerScript({
      version: "v1",
      precacheUrls: ["/"],
    });
    expect(script).toMatch(/clients\.claim\(\s*\)/);
  });

  test("deletes old caches on activate (so a version bump frees space)", () => {
    const script = buildServiceWorkerScript({
      version: "v1",
      precacheUrls: ["/"],
    });
    // We expect the activate handler to enumerate caches.keys() and delete
    // any whose name does not match the current version.
    expect(script).toMatch(/caches\.keys\(\s*\)/);
    expect(script).toMatch(/caches\.delete\(/);
  });

  test("the cacheNamePrefix option scopes the cache name (defaults to 'sosb')", () => {
    const dflt = buildServiceWorkerScript({
      version: "v1",
      precacheUrls: ["/"],
    });
    const custom = buildServiceWorkerScript({
      version: "v1",
      precacheUrls: ["/"],
      cacheNamePrefix: "custom",
    });
    expect(dflt).toContain("sosb");
    expect(custom).toContain("custom");
  });

  test("output is deterministic — same input produces the same script", () => {
    const a = buildServiceWorkerScript({
      version: "v1",
      precacheUrls: ["/", "/app.js"],
    });
    const b = buildServiceWorkerScript({
      version: "v1",
      precacheUrls: ["/", "/app.js"],
    });
    expect(a).toBe(b);
  });

  test("URLs are JSON-encoded so injection-shaped values cannot break out of the array literal", () => {
    const script = buildServiceWorkerScript({
      version: "v1",
      precacheUrls: ['/", malicious + "'],
    });
    // The malicious payload must not appear as un-escaped JS — it must be
    // inside a string. Re-parsing the precache literal as JSON proves it.
    const match = script.match(/PRECACHE_URLS\s*=\s*(\[.*?\])/s);
    expect(match).not.toBeNull();
    expect(() => JSON.parse(match![1]!)).not.toThrow();
    const parsed = JSON.parse(match![1]!) as string[];
    expect(parsed).toEqual(['/", malicious + "']);
  });
});
