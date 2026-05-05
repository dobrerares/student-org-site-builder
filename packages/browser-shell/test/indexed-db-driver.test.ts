// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { describe, expect, test } from "vitest";

import { runVfsConformance } from "@sosb/vfs/test-conformance";
import { openIndexedDbDriver } from "../src/persistent-vfs/indexed-db-driver.js";

/**
 * AC #1 + AC #5 — the browser shell needs a persistent VFS so the editor's
 * auto-saved snapshot survives a page reload (and so a service-worker-served
 * SPA in offline mode can still load the user's last work).
 *
 * The driver implements `@sosb/vfs.Vfs`. The contract is captured in
 * `runVfsConformance` — every driver passing that suite is a drop-in
 * substitute for any other.
 *
 * We use `fake-indexeddb/auto` so this test runs in node + jsdom without a
 * real browser. The implementation goes through the same `indexedDB`
 * global, so passing this suite via the fake gives high confidence the
 * driver works on a real Chromium / Firefox / Safari `indexedDB`.
 */

let dbCounter = 0;
function freshDbName(): string {
  dbCounter += 1;
  return `sosb-test-${process.pid}-${Date.now()}-${dbCounter}`;
}

runVfsConformance("IndexedDbDriver", async () => {
  return openIndexedDbDriver({ databaseName: freshDbName() });
});

/**
 * The "persists across reload" requirement: a fresh driver opened against
 * the same database name (simulating a page reload re-opening the DB)
 * sees the previously-written entries.
 */
describe("IndexedDbDriver — persistence across reload simulation", () => {
  test("a second driver instance opened against the same database sees prior writes", async () => {
    const dbName = freshDbName();
    const first = await openIndexedDbDriver({ databaseName: dbName });
    await first.write("editor/autosave.json", new TextEncoder().encode('{"hello":"world"}'));
    first.close();

    const second = await openIndexedDbDriver({ databaseName: dbName });
    const back = await second.read("editor/autosave.json");
    expect(new TextDecoder().decode(back)).toBe('{"hello":"world"}');
    second.close();
  });

  test("two independent database names do not see each other's data", async () => {
    const dbA = freshDbName();
    const dbB = freshDbName();
    const a = await openIndexedDbDriver({ databaseName: dbA });
    const b = await openIndexedDbDriver({ databaseName: dbB });

    await a.write("only-in-a.txt", new TextEncoder().encode("hi"));

    expect(await b.has("only-in-a.txt")).toBe(false);
    a.close();
    b.close();
  });
});
