import { describe, expect, test } from "vitest";
import { generateDeployMd, type DeployMdInput } from "../src/deploy-md.js";

/**
 * AC #43: DEPLOY.md must:
 *  - include both deploy paths (direct upload + Git-connected)
 *  - match the editor language at export time (RO/EN)
 *  - explain custom domain DNS pointing + HTTPS
 *  - be the same content shown by the in-app guide modal (single source)
 *  - reference screenshots under a stable path (so the human can drop real
 *    Cloudflare-dashboard captures alongside the doc)
 *
 * The generator is a pure `(input) -> string` function; the in-app modal
 * renders the same string the export bundles into the zip.
 */

const baseRo: DeployMdInput = {
  language: "ro",
  org: { name: "Asociația Studențească HISTORIPOL" },
};

const baseEn: DeployMdInput = {
  language: "en",
  org: { name: "HISTORIPOL Student Association" },
};

describe("generateDeployMd — output shape", () => {
  test("returns a non-empty string", () => {
    const md = generateDeployMd(baseRo);
    expect(typeof md).toBe("string");
    expect(md.length).toBeGreaterThan(0);
  });

  test("starts with a top-level Markdown heading", () => {
    const md = generateDeployMd(baseRo);
    expect(md.startsWith("# ")).toBe(true);
  });

  test("ends with a single trailing newline (POSIX text file convention)", () => {
    const md = generateDeployMd(baseRo);
    expect(md.endsWith("\n")).toBe(true);
    expect(md.endsWith("\n\n\n")).toBe(false);
  });

  test("uses LF line endings only (no CRLF)", () => {
    const md = generateDeployMd(baseRo);
    expect(md.includes("\r\n")).toBe(false);
    expect(md.includes("\r")).toBe(false);
  });
});

describe("generateDeployMd — determinism", () => {
  test("identical input produces byte-identical output", () => {
    const a = generateDeployMd(baseRo);
    const b = generateDeployMd(baseRo);
    expect(a).toBe(b);
  });

  test("input copy via structuredClone produces byte-identical output", () => {
    const a = generateDeployMd(baseRo);
    const b = generateDeployMd(structuredClone(baseRo));
    expect(a).toBe(b);
  });
});

describe("generateDeployMd — language switching (AC: editor-language match)", () => {
  test("RO output is in Romanian", () => {
    const md = generateDeployMd(baseRo);
    // Romanian-only words/phrases. We pick stable ones that won't easily
    // change as the prose evolves.
    expect(md).toMatch(/încărcare directă/i); // direct-upload path heading
    expect(md).toMatch(/conectat prin Git/i); // git-connected path heading
    expect(md).toMatch(/domeniu personalizat/i); // custom domain section
    expect(md).toMatch(/site-ului/i); // RO genitive form for "site"
  });

  test("EN output is in English", () => {
    const md = generateDeployMd(baseEn);
    expect(md).toMatch(/Cloudflare Pages/);
    expect(md).toMatch(/Direct upload/i);
    expect(md).toMatch(/Git-connected/i);
    expect(md).toMatch(/custom domain/i);
  });

  test("RO and EN outputs differ", () => {
    const ro = generateDeployMd(baseRo);
    const en = generateDeployMd(baseEn);
    expect(ro).not.toBe(en);
  });

  test("RO output does not contain telltale English headings", () => {
    const md = generateDeployMd(baseRo);
    expect(md).not.toMatch(/^## Direct upload/m);
    expect(md).not.toMatch(/^## Git-connected/m);
    expect(md).not.toMatch(/^## Custom domain/m);
  });

  test("EN output does not contain telltale Romanian headings", () => {
    const md = generateDeployMd(baseEn);
    expect(md).not.toMatch(/^## Încărcare/m);
    expect(md).not.toMatch(/^## Conectat prin Git/m);
    expect(md).not.toMatch(/^## Domeniu personalizat/m);
  });

  test("rejects unsupported languages with a typed error", () => {
    expect(() =>
      generateDeployMd({
        // @ts-expect-error - validating runtime guard, not type system
        language: "fr",
        org: { name: "Test" },
      }),
    ).toThrow(/language/i);
  });
});

describe("generateDeployMd — both deploy paths (AC #1)", () => {
  test("RO contains both direct-upload and git-connected sections", () => {
    const md = generateDeployMd(baseRo);
    expect(md).toMatch(/^## .*[Îî]ncărcare directă/m);
    expect(md).toMatch(/^## .*conectat prin Git/im);
  });

  test("EN contains both direct-upload and git-connected sections", () => {
    const md = generateDeployMd(baseEn);
    expect(md).toMatch(/^## .*Direct upload/im);
    expect(md).toMatch(/^## .*Git-connected/im);
  });

  test("RO direct-upload path explains drag-and-drop of dist", () => {
    const md = generateDeployMd(baseRo);
    expect(md).toMatch(/dist/);
  });

  test("EN direct-upload path explains drag-and-drop of dist", () => {
    const md = generateDeployMd(baseEn);
    expect(md).toMatch(/dist/);
  });
});

describe("generateDeployMd — custom domain section (AC #4)", () => {
  test("RO covers DNS pointing and HTTPS", () => {
    const md = generateDeployMd(baseRo);
    expect(md).toMatch(/^## .*[Dd]omeniu personalizat/im);
    expect(md).toMatch(/CNAME/i);
    expect(md).toMatch(/HTTPS|TLS|SSL/);
    expect(md).toMatch(/DNS/);
  });

  test("EN covers DNS pointing and HTTPS", () => {
    const md = generateDeployMd(baseEn);
    expect(md).toMatch(/^## .*Custom domain/im);
    expect(md).toMatch(/CNAME/i);
    expect(md).toMatch(/HTTPS|TLS|SSL/);
    expect(md).toMatch(/DNS/);
  });

  test("when customDomain is provided, it appears in the custom-domain section", () => {
    const md = generateDeployMd({ ...baseRo, customDomain: "historipol.ro" });
    expect(md).toContain("historipol.ro");
  });

  test("when customDomain is omitted, the section still renders with a placeholder", () => {
    const md = generateDeployMd(baseRo);
    // The placeholder should look like a domain or a clear instruction.
    expect(md).toMatch(/example\.org|domeniul tău|<your-domain>/i);
  });
});

describe("generateDeployMd — siteUrl flow", () => {
  test("when siteUrl is provided, build-step instructions reference it", () => {
    const md = generateDeployMd({
      ...baseRo,
      siteUrl: "https://historipol.ro",
    });
    expect(md).toContain("https://historipol.ro");
  });

  test("when siteUrl is omitted, the doc still renders without leaking 'undefined'", () => {
    const md = generateDeployMd(baseRo);
    expect(md).not.toMatch(/undefined/);
    expect(md).not.toMatch(/null/);
  });
});

describe("generateDeployMd — org personalization", () => {
  test("includes the org name in the document title (RO)", () => {
    const md = generateDeployMd(baseRo);
    expect(md).toContain("Asociația Studențească HISTORIPOL");
  });

  test("includes the org name in the document title (EN)", () => {
    const md = generateDeployMd(baseEn);
    expect(md).toContain("HISTORIPOL Student Association");
  });

  test("escapes Markdown-significant characters in the org name (no injection)", () => {
    const md = generateDeployMd({
      language: "en",
      org: { name: 'AT&T "Special" Org <script>' },
    });
    // We never emit the raw `<script>` substring (would render as inline HTML
    // in some Markdown viewers). The implementation must HTML-escape angle
    // brackets in the rendered title.
    expect(md).not.toContain("<script>");
  });
});

describe("generateDeployMd — screenshots references (AC #5)", () => {
  test("RO references screenshot images under a stable docs path", () => {
    const md = generateDeployMd(baseRo);
    // We use the docs folder so the human can drop real Cloudflare-dashboard
    // captures into `docs/deploy/screenshots/` and they show up in both the
    // in-repo doc and the exported DEPLOY.md.
    expect(md).toMatch(/!\[.*\]\(.*screenshots\/.*\.(png|jpg|jpeg|webp)\)/);
  });

  test("EN references screenshot images under a stable docs path", () => {
    const md = generateDeployMd(baseEn);
    expect(md).toMatch(/!\[.*\]\(.*screenshots\/.*\.(png|jpg|jpeg|webp)\)/);
  });

  test("screenshotsBaseUrl override is honoured", () => {
    const md = generateDeployMd({
      ...baseRo,
      screenshotsBaseUrl: "https://historipol.ro/docs/screenshots/",
    });
    expect(md).toContain("https://historipol.ro/docs/screenshots/");
  });

  test("when no override, paths are repo-relative under docs/deploy/screenshots/", () => {
    const md = generateDeployMd(baseRo);
    expect(md).toContain("docs/deploy/screenshots/");
  });
});

describe("generateDeployMd — Markdown structure", () => {
  test("uses ATX-style headings exclusively", () => {
    const md = generateDeployMd(baseRo);
    // No setext-style underlines (`---` / `===` directly under a non-empty line).
    const lines = md.split("\n");
    for (let i = 1; i < lines.length; i++) {
      const prev = lines[i - 1] ?? "";
      const cur = lines[i] ?? "";
      if (prev.trim().length > 0 && /^=+\s*$/.test(cur)) {
        throw new Error(`setext heading at line ${i + 1}: ${prev}`);
      }
      if (prev.trim().length > 0 && /^-+\s*$/.test(cur) && !cur.startsWith("- ")) {
        // Lone `---` on its own is fine (horizontal rule), but only when the
        // previous line is blank — which we already ensured isn't the case.
        throw new Error(`setext heading at line ${i + 1}: ${prev}`);
      }
    }
  });

  test("has a stable section order: intro → direct upload → git → custom domain → next steps", () => {
    const md = generateDeployMd(baseEn);
    const directIdx = md.search(/^## .*Direct upload/im);
    const gitIdx = md.search(/^## .*Git-connected/im);
    const domainIdx = md.search(/^## .*Custom domain/im);
    expect(directIdx).toBeGreaterThan(0);
    expect(gitIdx).toBeGreaterThan(directIdx);
    expect(domainIdx).toBeGreaterThan(gitIdx);
  });

  test("contains numbered steps in both deploy paths (RO)", () => {
    const md = generateDeployMd(baseRo);
    expect(md).toMatch(/^1\. /m);
    expect(md).toMatch(/^2\. /m);
    expect(md).toMatch(/^3\. /m);
  });

  test("contains numbered steps in both deploy paths (EN)", () => {
    const md = generateDeployMd(baseEn);
    expect(md).toMatch(/^1\. /m);
    expect(md).toMatch(/^2\. /m);
    expect(md).toMatch(/^3\. /m);
  });
});

describe("generateDeployMd — privacy / safety claims", () => {
  test("does not promise behaviour Cloudflare may not deliver (e.g. specific SLAs)", () => {
    // Guards against the doc growing claims like "99.99% uptime" or
    // "automatic edge caching speedup" that aren't ours to make.
    const ro = generateDeployMd(baseRo);
    const en = generateDeployMd(baseEn);
    for (const md of [ro, en]) {
      expect(md).not.toMatch(/99\.99%/);
      expect(md).not.toMatch(/SLA/i);
      expect(md).not.toMatch(/guaranteed/i);
      expect(md).not.toMatch(/garantat/i);
    }
  });

  test("does not promise free pricing tiers (Cloudflare can change them)", () => {
    // We say "free tier as of writing" or similar — never an unconditional
    // "free forever" claim. This test guards against drift.
    const ro = generateDeployMd(baseRo);
    const en = generateDeployMd(baseEn);
    expect(ro).not.toMatch(/gratuit pentru totdeauna/i);
    expect(en).not.toMatch(/free forever/i);
  });
});
