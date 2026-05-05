import { describe, expect, test } from "vitest";
import { EventListBlockSchema, validateBlock } from "../src/index.js";

/**
 * eventList block schema tests.
 *
 * The block carries an optional `title` and `intro`, plus an `events` array
 * of single-occurrence events with ISO 8601 `startsAt` (and optional
 * `endsAt`). The block configures `sortBy` (`date-asc` | `date-desc`) and
 * `pastBehavior` (`show` | `fade` | `hide`); both default at render time.
 *
 * Per the PRD (and issue #22): no recurring rules, no iCal export, no
 * per-event timezone override. The site-wide timezone is Europe/Bucharest;
 * `startsAt` therefore must include a timezone designator (UTC `Z` or a
 * numeric offset like `+03:00`) so the comparison Date.parse uses is
 * unambiguous.
 */
describe("eventList block schema", () => {
  test("validates a minimal well-formed eventList block (empty events)", () => {
    const block = {
      id: "blk_events_1",
      type: "eventList",
      version: 1,
      data: {
        events: [],
      },
    };
    expect(EventListBlockSchema.safeParse(block).success).toBe(true);
  });

  test("validates an eventList block with one ISO 8601 event", () => {
    const block = {
      id: "blk_events_2",
      type: "eventList",
      version: 1,
      data: {
        title: "Evenimente",
        intro: "Activitățile noastre din acest an",
        events: [
          {
            id: "ev_01",
            title: "Conferința de istorie",
            startsAt: "2026-06-15T18:00:00+03:00",
            location: "Aula universității",
          },
        ],
        sortBy: "date-asc",
        pastBehavior: "fade",
      },
    };
    const result = EventListBlockSchema.safeParse(block);
    expect(result.success).toBe(true);
  });

  test("validates an eventList block with all optional fields populated", () => {
    const block = {
      id: "blk_events_3",
      type: "eventList",
      version: 1,
      data: {
        title: "Evenimente",
        intro: "Toate activitățile.",
        events: [
          {
            id: "ev_01",
            title: "Atelier de paleografie",
            description: "Un atelier hands-on cu surse de arhivă.",
            image: "assets/4a91d2.jpg",
            startsAt: "2026-06-15T18:00:00+03:00",
            endsAt: "2026-06-15T20:00:00+03:00",
            location: "Sala 3.4",
            url: "https://historipol.ro/eveniment/paleografie",
          },
        ],
        sortBy: "date-desc",
        pastBehavior: "hide",
      },
    };
    expect(EventListBlockSchema.safeParse(block).success).toBe(true);
  });

  test("accepts ISO 8601 with a `Z` (UTC) suffix on startsAt", () => {
    const block = {
      id: "blk_events_4",
      type: "eventList",
      version: 1,
      data: {
        events: [
          {
            id: "ev_01",
            title: "All-hands",
            startsAt: "2026-06-15T15:00:00Z",
          },
        ],
      },
    };
    expect(EventListBlockSchema.safeParse(block).success).toBe(true);
  });

  test("rejects events with a non-ISO 8601 startsAt", () => {
    const block = {
      id: "blk_events_5",
      type: "eventList",
      version: 1,
      data: {
        events: [
          {
            id: "ev_01",
            title: "Bad date",
            startsAt: "tomorrow at noon",
          },
        ],
      },
    };
    expect(EventListBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects events whose startsAt has no timezone designator", () => {
    // Per the PRD's site-wide-timezone v1 contract, `startsAt` must be
    // unambiguous: it carries either `Z` (UTC) or an explicit numeric
    // offset. A naive local-time string like `2026-06-15T18:00:00` is
    // rejected because two clients in different timezones would read it
    // differently when computing past-vs-future.
    const block = {
      id: "blk_events_6",
      type: "eventList",
      version: 1,
      data: {
        events: [
          {
            id: "ev_01",
            title: "Ambiguous time",
            startsAt: "2026-06-15T18:00:00",
          },
        ],
      },
    };
    expect(EventListBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects events with an empty title", () => {
    const block = {
      id: "blk_events_7",
      type: "eventList",
      version: 1,
      data: {
        events: [
          {
            id: "ev_01",
            title: "",
            startsAt: "2026-06-15T18:00:00+03:00",
          },
        ],
      },
    };
    expect(EventListBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects events with an empty id", () => {
    const block = {
      id: "blk_events_8",
      type: "eventList",
      version: 1,
      data: {
        events: [
          {
            id: "",
            title: "X",
            startsAt: "2026-06-15T18:00:00+03:00",
          },
        ],
      },
    };
    expect(EventListBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects events whose endsAt is not ISO 8601 when present", () => {
    const block = {
      id: "blk_events_9",
      type: "eventList",
      version: 1,
      data: {
        events: [
          {
            id: "ev_01",
            title: "X",
            startsAt: "2026-06-15T18:00:00+03:00",
            endsAt: "later that night",
          },
        ],
      },
    };
    expect(EventListBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects sortBy values outside the closed set", () => {
    const block = {
      id: "blk_events_10",
      type: "eventList",
      version: 1,
      data: {
        events: [],
        sortBy: "alphabetical",
      },
    };
    expect(EventListBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects pastBehavior values outside the closed set", () => {
    const block = {
      id: "blk_events_11",
      type: "eventList",
      version: 1,
      data: {
        events: [],
        pastBehavior: "blink",
      },
    };
    expect(EventListBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects eventList blocks with the wrong type tag", () => {
    const block = {
      id: "blk_events_12",
      type: "richText",
      version: 1,
      data: { events: [] },
    };
    expect(EventListBlockSchema.safeParse(block).success).toBe(false);
  });

  test("validateBlock returns error severity for malformed eventList blocks", () => {
    const block = {
      id: "blk_events_13",
      type: "eventList",
      version: 1,
      data: {
        events: [
          {
            id: "ev_01",
            title: "Bad",
            startsAt: "not-a-date",
          },
        ],
      },
    };
    const result = validateBlock(block);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]!.severity).toBe("error");
  });

  test("validateBlock accepts a well-formed eventList without warnings", () => {
    const block = {
      id: "blk_events_14",
      type: "eventList",
      version: 1,
      data: {
        events: [
          {
            id: "ev_01",
            title: "Conferință",
            startsAt: "2026-09-01T16:00:00+03:00",
            image: "assets/4a91d2.jpg",
          },
        ],
      },
    };
    const result = validateBlock(block);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test("preserves unknown fields on event-list data (forward-compat)", () => {
    const block = {
      id: "blk_events_15",
      type: "eventList",
      version: 1,
      data: {
        events: [],
        futureField: "preserved",
      },
    };
    const parsed = EventListBlockSchema.safeParse(block);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const data = parsed.data.data as Record<string, unknown>;
      expect(data.futureField).toBe("preserved");
    }
  });

  test("preserves unknown fields on a single event entry (forward-compat)", () => {
    const block = {
      id: "blk_events_16",
      type: "eventList",
      version: 1,
      data: {
        events: [
          {
            id: "ev_01",
            title: "X",
            startsAt: "2026-06-15T18:00:00+03:00",
            futureCustomField: { kind: "experimental" },
          },
        ],
      },
    };
    const parsed = EventListBlockSchema.safeParse(block);
    expect(parsed.success).toBe(true);
  });
});
