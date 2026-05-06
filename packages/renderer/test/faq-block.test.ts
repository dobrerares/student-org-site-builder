import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import faqOnly from "./fixtures/faq-only.json" with { type: "json" };
import { renderSite } from "../src/index.js";

const fixture = faqOnly as unknown as Site;

describe("renderSite — faq block (structural)", () => {
  test("renders a <section data-block=faq>", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/<section[^>]*data-block="faq"/);
  });

  test("renders the data-block-id from the schema id", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/data-block-id="blk_faq_main"/);
  });

  test("renders the optional title as an <h2>", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/<h2[^>]*>Întrebări frecvente<\/h2>/);
  });

  test("renders each item as a <details><summary>...</summary>...</details>", () => {
    const html = renderSite(fixture, "stub");
    // Three items in fixture.
    const detailsCount = [...html.matchAll(/<details[\s>]/g)].length;
    expect(detailsCount).toBe(3);
    const summaryCount = [...html.matchAll(/<summary[\s>]/g)].length;
    expect(summaryCount).toBe(3);
  });

  test("places the question text inside <summary>", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/<summary[^>]*>[\s\S]*?Cine poate să se înscrie\?[\s\S]*?<\/summary>/);
    expect(html).toMatch(/<summary[^>]*>[\s\S]*?Care sunt etapele\?[\s\S]*?<\/summary>/);
    expect(html).toMatch(/<summary[^>]*>[\s\S]*?Există costuri\?[\s\S]*?<\/summary>/);
  });

  test("renders the answer markdown through @sosb/markdown (whitelist HTML)", () => {
    const html = renderSite(fixture, "stub");
    // **student** => <strong>student</strong>
    expect(html).toContain("<strong>student</strong>");
    // *participarea* => <em>participarea</em>
    expect(html).toContain("<em>participarea</em>");
    // [regulamentul](https://anosr.ro/reg) => <a href="https://anosr.ro/reg">regulamentul</a>
    expect(html).toMatch(/<a\s+href="https:\/\/anosr\.ro\/reg"[^>]*>regulamentul<\/a>/);
    // - bullets => <ul>...</ul>
    expect(html).toMatch(/<ul[^>]*>[\s\S]*<li[^>]*>Trimite email<\/li>[\s\S]*<\/ul>/);
  });

  test("opens the first item when firstOpen=true", () => {
    const html = renderSite(fixture, "stub");
    // Find first <details> tag and ensure it has the `open` boolean attribute.
    const firstDetails = /<details([^>]*)>/.exec(html);
    expect(firstDetails).not.toBeNull();
    expect(firstDetails![1]).toMatch(/\bopen\b/);
  });

  test("does NOT open subsequent items when firstOpen=true", () => {
    const html = renderSite(fixture, "stub");
    const detailsTags = [...html.matchAll(/<details([^>]*)>/g)].map((m) => m[1] ?? "");
    expect(detailsTags.length).toBe(3);
    // First open, others closed.
    expect(detailsTags[0]).toMatch(/\bopen\b/);
    expect(detailsTags[1]).not.toMatch(/\bopen\b/);
    expect(detailsTags[2]).not.toMatch(/\bopen\b/);
  });

  test("leaves all items closed when firstOpen is omitted (default)", () => {
    const allClosed = JSON.parse(JSON.stringify(fixture)) as Site;
    delete (allClosed.pages[0]!.blocks[0]!.data as { firstOpen?: boolean }).firstOpen;
    const html = renderSite(allClosed, "stub");
    const detailsTags = [...html.matchAll(/<details([^>]*)>/g)].map((m) => m[1] ?? "");
    expect(detailsTags.length).toBe(3);
    expect(detailsTags.every((t) => !/\bopen\b/.test(t))).toBe(true);
  });

  test("leaves all items closed when firstOpen=false", () => {
    const explicit = JSON.parse(JSON.stringify(fixture)) as Site;
    (explicit.pages[0]!.blocks[0]!.data as { firstOpen: boolean }).firstOpen = false;
    const html = renderSite(explicit, "stub");
    const detailsTags = [...html.matchAll(/<details([^>]*)>/g)].map((m) => m[1] ?? "");
    expect(detailsTags.every((t) => !/\bopen\b/.test(t))).toBe(true);
  });

  test("never emits non-whitelist HTML elements from faq markdown answers", () => {
    const malicious = JSON.parse(JSON.stringify(fixture)) as Site;
    (
      malicious.pages[0]!.blocks[0]!.data as { items: { question: string; answer: string }[] }
    ).items = [
      {
        question: "Hostile?",
        answer: "<script>x()</script>\n\n[click](javascript:x())\n\n<img src=x onerror=x()>",
      },
    ];
    const html = renderSite(malicious, "stub");
    expect(html).not.toMatch(/<script[^>]*>/i);
    expect(html).not.toMatch(/<img[^>]*onerror/i);
    const realA = /<a\s+href="([^"]*)"/gi;
    let m: RegExpExecArray | null;
    while ((m = realA.exec(html)) !== null) {
      expect(m[1]).not.toMatch(/^\s*javascript:/i);
    }
  });

  test("tolerates an empty items list (placeholder block)", () => {
    const empty = JSON.parse(JSON.stringify(fixture)) as Site;
    (empty.pages[0]!.blocks[0]!.data as { items: unknown[] }).items = [];
    const html = renderSite(empty, "stub");
    expect(html).toMatch(/<section[^>]*data-block="faq"/);
    // No <details> elements are emitted for an empty list.
    expect(html).not.toMatch(/<details[\s>]/);
  });

  test("ignores unknown extra fields on faq data and items (forward-compat)", () => {
    const withExtra = JSON.parse(JSON.stringify(fixture)) as Site;
    (withExtra.pages[0]!.blocks[0]!.data as Record<string, unknown>).layout = "two-column";
    const item0 = (withExtra.pages[0]!.blocks[0]!.data as { items: Record<string, unknown>[] })
      .items[0]!;
    item0.anchor = "join";
    const html = renderSite(withExtra, "stub");
    // Title and first question still render.
    expect(html).toContain("Întrebări frecvente");
    expect(html).toMatch(/Cine poate să se înscrie\?/);
  });

  test("escapes HTML in question text (XSS-safe)", () => {
    const xss = JSON.parse(JSON.stringify(fixture)) as Site;
    (xss.pages[0]!.blocks[0]!.data as { items: { question: string; answer: string }[] }).items = [
      { question: "<script>alert('q')</script>", answer: "ok" },
    ];
    const html = renderSite(xss, "stub");
    // The summary must NOT contain a real <script> element.
    expect(html).not.toMatch(/<summary[^>]*>[\s\S]*?<script\b[\s\S]*?<\/summary>/i);
    // The dangerous opening angle bracket must be HTML-escaped (Preact /
    // preact-render-to-string escapes `<` → `&lt;` in text content).
    expect(html).toMatch(/<summary[^>]*>[\s\S]*?&lt;script[\s\S]*?<\/summary>/i);
  });

  test("does not require a title (no <h2> when title omitted)", () => {
    const noTitle = JSON.parse(JSON.stringify(fixture)) as Site;
    delete (noTitle.pages[0]!.blocks[0]!.data as { title?: string }).title;
    const html = renderSite(noTitle, "stub");
    // The faq section still renders (questions still appear).
    expect(html).toMatch(/<section[^>]*data-block="faq"/);
    // But no h2 inside the faq section.
    const faqSection = /<section[^>]*data-block="faq"[\s\S]*?<\/section>/.exec(html);
    expect(faqSection).not.toBeNull();
    expect(faqSection![0]).not.toMatch(/<h2[^>]*>Întrebări frecvente<\/h2>/);
  });
});

describe("renderSite — faq golden file", () => {
  test("faq fixture under stub theme matches its golden file", async () => {
    const html = renderSite(fixture, "stub");
    await expect(html).toMatchFileSnapshot("__golden__/stub-theme-faq.html");
  });
});
