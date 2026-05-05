// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { EVENT_LIST_PAST_FADE_SCRIPT } from "../src/blocks/event-list-past-fade.js";

/**
 * Past-fade JS unit tests.
 *
 * The shipped script is a single self-contained string the renderer inlines
 * in `<script>`. It runs at page-load, walks every
 * `[data-block="event-list"]` element, and for each `[data-event-id]` child
 * compares its `data-starts-at` (an ISO 8601 datetime with a timezone) to
 * `Date.now()`. Behaviour is configured per-block via `data-past-behavior`:
 *
 *  - `show`  — no DOM mutation. Past events render identically to upcoming.
 *  - `fade`  — past events get an `is-past` class for CSS to style.
 *  - `hide`  — past events are removed from the DOM after first render.
 *
 * These tests exercise the script in jsdom with a fakeable Date.now so we
 * can pin "now" to specific instants and assert the resulting DOM. The
 * renderer's build-time output is independent of `now` (the determinism
 * AC); the runtime behaviour here is what the AC "Past-fade JS correctly
 * identifies past events on page load (uses `Date.now()`)" exercises.
 *
 * SECURITY NOTE: tests use the Function constructor on an in-tree
 * compile-time constant (`EVENT_LIST_PAST_FADE_SCRIPT`). The string is the
 * exact source the renderer ships in `<script>`; running it via
 * `new Function(source)()` is the most faithful way to assert the bytes
 * the browser will execute. There is no untrusted input on this path.
 */

const PAST_ISO = "2024-01-01T12:00:00+00:00"; // before "now" in tests
const FUTURE_ISO = "2099-01-01T12:00:00+00:00"; // after "now" in tests

function fixedNowMs(iso: string): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`Bad fixed now: ${iso}`);
  return ms;
}

function buildBlock(pastBehavior: "show" | "fade" | "hide"): HTMLElement {
  const section = document.createElement("section");
  section.setAttribute("data-block", "event-list");
  section.setAttribute("data-past-behavior", pastBehavior);

  const past = document.createElement("article");
  past.setAttribute("data-event-id", "ev_past");
  past.setAttribute("data-starts-at", PAST_ISO);
  past.textContent = "Past event";
  section.appendChild(past);

  const future = document.createElement("article");
  future.setAttribute("data-event-id", "ev_future");
  future.setAttribute("data-starts-at", FUTURE_ISO);
  future.textContent = "Future event";
  section.appendChild(future);

  document.body.appendChild(section);
  return section;
}

function runPastFadeScript(): void {
  // Compile and execute the renderer's shipped past-fade script in the
  // jsdom global. The source is an in-tree compile-time constant — the
  // very same bytes the renderer inlines in `<script>` — so this is the
  // most faithful "what the browser will run" simulation. No untrusted
  // input ever flows through this path.
  new Function(EVENT_LIST_PAST_FADE_SCRIPT)();
}

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("event-list past-fade script", () => {
  test("'fade': adds is-past class to past events, leaves future events alone", () => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedNowMs("2026-05-01T00:00:00Z"));
    const section = buildBlock("fade");
    runPastFadeScript();
    const pastEl = section.querySelector('[data-event-id="ev_past"]')!;
    const futureEl = section.querySelector('[data-event-id="ev_future"]')!;
    expect(pastEl.classList.contains("is-past")).toBe(true);
    expect(futureEl.classList.contains("is-past")).toBe(false);
  });

  test("'hide': removes past events from the DOM, keeps future events", () => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedNowMs("2026-05-01T00:00:00Z"));
    const section = buildBlock("hide");
    runPastFadeScript();
    expect(section.querySelector('[data-event-id="ev_past"]')).toBeNull();
    expect(section.querySelector('[data-event-id="ev_future"]')).not.toBeNull();
  });

  test("'show': leaves the DOM unchanged — no class added, no element removed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedNowMs("2026-05-01T00:00:00Z"));
    const section = buildBlock("show");
    runPastFadeScript();
    const pastEl = section.querySelector('[data-event-id="ev_past"]')!;
    const futureEl = section.querySelector('[data-event-id="ev_future"]')!;
    expect(pastEl).not.toBeNull();
    expect(futureEl).not.toBeNull();
    expect(pastEl.classList.contains("is-past")).toBe(false);
    expect(futureEl.classList.contains("is-past")).toBe(false);
  });

  test("treats endsAt > now as 'still upcoming/ongoing' even if startsAt < now", () => {
    // An event that started in the past but has not yet ended should not be
    // considered "past" — it is currently ongoing. The script must consider
    // the optional endsAt when present.
    vi.useFakeTimers();
    // Pin now to an instant inside the event window.
    vi.setSystemTime(fixedNowMs("2026-05-01T13:00:00Z"));

    const section = document.createElement("section");
    section.setAttribute("data-block", "event-list");
    section.setAttribute("data-past-behavior", "fade");
    const ongoing = document.createElement("article");
    ongoing.setAttribute("data-event-id", "ev_ongoing");
    ongoing.setAttribute("data-starts-at", "2026-05-01T12:00:00Z");
    ongoing.setAttribute("data-ends-at", "2026-05-01T15:00:00Z");
    section.appendChild(ongoing);
    document.body.appendChild(section);

    runPastFadeScript();
    expect(ongoing.classList.contains("is-past")).toBe(false);
  });

  test("treats events with no endsAt as past once startsAt is before now", () => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedNowMs("2026-05-02T00:00:00Z"));

    const section = document.createElement("section");
    section.setAttribute("data-block", "event-list");
    section.setAttribute("data-past-behavior", "fade");
    const noEnd = document.createElement("article");
    noEnd.setAttribute("data-event-id", "ev_no_end");
    noEnd.setAttribute("data-starts-at", "2026-05-01T12:00:00Z");
    section.appendChild(noEnd);
    document.body.appendChild(section);

    runPastFadeScript();
    expect(noEnd.classList.contains("is-past")).toBe(true);
  });

  test("ignores events whose data-starts-at is unparseable (defensive)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedNowMs("2026-05-01T00:00:00Z"));

    const section = document.createElement("section");
    section.setAttribute("data-block", "event-list");
    section.setAttribute("data-past-behavior", "hide");
    const garbage = document.createElement("article");
    garbage.setAttribute("data-event-id", "ev_bad");
    garbage.setAttribute("data-starts-at", "not-a-date");
    section.appendChild(garbage);
    document.body.appendChild(section);

    // Schema rejects this at validate() time, but if a stale page survives
    // a stricter schema upgrade we want defensive behaviour: leave the
    // element where it is rather than throwing.
    expect(() => runPastFadeScript()).not.toThrow();
    expect(section.querySelector('[data-event-id="ev_bad"]')).not.toBeNull();
  });

  test("processes multiple eventList blocks on one page independently", () => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedNowMs("2026-05-01T00:00:00Z"));

    const fadeBlock = buildBlock("fade");
    const hideBlock = buildBlock("hide");
    runPastFadeScript();

    // The fade block keeps both elements but flags the past one.
    const fadePast = fadeBlock.querySelector('[data-event-id="ev_past"]')!;
    expect(fadePast).not.toBeNull();
    expect(fadePast.classList.contains("is-past")).toBe(true);

    // The hide block strips its past element.
    expect(hideBlock.querySelector('[data-event-id="ev_past"]')).toBeNull();
    expect(hideBlock.querySelector('[data-event-id="ev_future"]')).not.toBeNull();
  });

  test("the script source itself is under 1.5kb (PRD budget)", () => {
    // The PRD budgets the past-fade script at <1.5kb minified. Our shipped
    // string is hand-tuned and minimal; we assert the un-gzipped raw body
    // stays under 1500 bytes so any future bloat surfaces in CI.
    expect(EVENT_LIST_PAST_FADE_SCRIPT.length).toBeLessThan(1500);
  });

  test("the script is deterministic across imports (no embedded build state)", async () => {
    const fresh = await import("../src/blocks/event-list-past-fade.js");
    expect(fresh.EVENT_LIST_PAST_FADE_SCRIPT).toBe(EVENT_LIST_PAST_FADE_SCRIPT);
    // No build-time `Date.now()` baked in.
    expect(EVENT_LIST_PAST_FADE_SCRIPT).not.toMatch(/\b1[7-9]\d{11}\b/);
  });
});
