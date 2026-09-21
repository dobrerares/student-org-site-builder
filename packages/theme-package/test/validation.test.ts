/**
 * Rejection behaviour (issue #107: "define validation and rejection
 * behavior").
 *
 * Each case asserts a stable `code` *and* that the message names the thing
 * that is wrong. The codes are what the editor branches on; the messages are
 * what the Theme author reads at 11pm wondering why their package will not
 * import. Both are part of the contract.
 */

import { describe, expect, test } from "vitest";
import { ThemePackageError, loadThemePackage } from "../src/index.js";

const enc = new TextEncoder();

const VALID_MANIFEST = {
  formatVersion: 1,
  id: "org.example.test",
  name: "Test",
  version: "1.0.0",
  builder: { formatVersion: 1 },
  css: "theme.css",
};

function pkg(
  manifest: unknown,
  extra: Record<string, string | Uint8Array> = { "theme.css": "body{color:red}" },
): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>();
  if (manifest !== undefined) {
    files.set("theme.json", enc.encode(JSON.stringify(manifest)));
  }
  for (const [path, body] of Object.entries(extra)) {
    files.set(path, typeof body === "string" ? enc.encode(body) : body);
  }
  return files;
}

function expectRejection(files: Map<string, Uint8Array>, code: string, messageMatch: RegExp): void {
  try {
    loadThemePackage(files);
  } catch (error) {
    expect(error).toBeInstanceOf(ThemePackageError);
    expect((error as ThemePackageError).code).toBe(code);
    expect((error as ThemePackageError).message).toMatch(messageMatch);
    return;
  }
  throw new Error(`expected loadThemePackage to reject with ${code}`);
}

describe("a well-formed package", () => {
  test("loads with sensible defaults for everything optional", () => {
    const { bundle, manifest } = loadThemePackage(pkg(VALID_MANIFEST));
    expect(bundle.id).toBe("org.example.test");
    expect(bundle.origin).toBe("package");
    // Unstated support means "I honour the author's choices".
    expect(bundle.supports).toEqual({ colors: true, fonts: true, density: true, radius: true });
    expect(bundle.blockVariants).toEqual({});
    expect(bundle.fontSource.kind).toBe("registry");
    expect(manifest.description).toBe("");
  });

  test("preserves unknown manifest keys so a phase-two package still parses", () => {
    // ADR 0050's forward-compatibility rule: a package carrying phase-two
    // keys must load in this builder, not be rejected as malformed.
    const { manifest } = loadThemePackage(
      pkg({ ...VALID_MANIFEST, render: "render.js", blocks: [{ type: "x/y" }] }),
    );
    expect((manifest as unknown as { render?: string }).render).toBe("render.js");
  });
});

describe("manifest rejections", () => {
  test("a missing theme.json", () => {
    expectRejection(pkg(undefined), "manifest-missing", /must contain theme\.json/);
  });

  test("theme.json that is not JSON", () => {
    const files = new Map<string, Uint8Array>();
    files.set("theme.json", enc.encode("{not json"));
    expectRejection(files, "manifest-missing", /not valid JSON/);
  });

  test("a future formatVersion asks for a newer builder", () => {
    expectRejection(
      pkg({ ...VALID_MANIFEST, formatVersion: 2 }),
      "format-version-unsupported",
      /format version 2.*supports version 1/s,
    );
  });

  test("a non-namespaced id", () => {
    expectRejection(pkg({ ...VALID_MANIFEST, id: "dark" }), "manifest-invalid", /namespaced/);
  });

  test("an id with unsafe characters", () => {
    expectRejection(
      pkg({ ...VALID_MANIFEST, id: "org.example/../evil" }),
      "manifest-invalid",
      /namespaced/,
    );
  });

  test("a non-semver version", () => {
    expectRejection(pkg({ ...VALID_MANIFEST, version: "v1" }), "manifest-invalid", /semver/);
  });
});

describe("missing-file rejections", () => {
  test("the stylesheet the manifest names", () => {
    expectRejection(pkg(VALID_MANIFEST, {}), "file-missing", /theme\.css.*does not contain it/);
  });

  test("a declared font file", () => {
    expectRejection(
      pkg({
        ...VALID_MANIFEST,
        fonts: [{ family: "X", weight: 400, file: "fonts/x.woff2" }],
      }),
      "file-missing",
      /fonts\/x\.woff2.*not in the package/,
    );
  });

  test("a decorative file the CSS references", () => {
    expectRejection(
      pkg(VALID_MANIFEST, { "theme.css": "body{background:url(assets/missing.svg)}" }),
      "file-missing",
      /assets\/missing\.svg.*not in the package/,
    );
  });
});

describe("offline enforcement (ADR 0046)", () => {
  test("a remote @import is rejected", () => {
    expectRejection(
      pkg(VALID_MANIFEST, {
        "theme.css": '@import url("https://fonts.example.com/css?family=X");',
      }),
      "css-unsafe",
      /remote @import.*render offline/s,
    );
  });

  test("a bare-string remote @import is rejected", () => {
    expectRejection(
      pkg(VALID_MANIFEST, { "theme.css": '@import "https://cdn.example/reset.css";' }),
      "css-unsafe",
      /remote @import/,
    );
  });

  test("a protocol-relative url() is rejected", () => {
    expectRejection(
      pkg(VALID_MANIFEST, { "theme.css": "body{background:url(//cdn.example/x.png)}" }),
      "css-unsafe",
      /remote url/,
    );
  });

  test("an http url() is rejected", () => {
    expectRejection(
      pkg(VALID_MANIFEST, { "theme.css": "body{background:url(http://x.test/a.png)}" }),
      "css-unsafe",
      /remote url/,
    );
  });

  test("an absolute root url() is rejected", () => {
    expectRejection(
      pkg(VALID_MANIFEST, { "theme.css": "body{background:url(/logo.png)}" }),
      "css-unsafe",
      /absolute url/,
    );
  });

  test("a url() escaping the package is rejected", () => {
    expectRejection(
      pkg(VALID_MANIFEST, { "theme.css": "body{background:url(../../secrets.png)}" }),
      "path-unsafe",
      /escapes the package/,
    );
  });

  test("a data: url is allowed — it carries its own bytes", () => {
    expect(() =>
      loadThemePackage(
        pkg(VALID_MANIFEST, {
          "theme.css": "body{background:url(data:image/svg+xml;base64,PHN2Zy8+)}",
        }),
      ),
    ).not.toThrow();
  });
});

describe("path safety", () => {
  test("an entry escaping the package root is rejected", () => {
    const files = pkg(VALID_MANIFEST);
    files.set("../evil.css", enc.encode("x"));
    expectRejection(files, "path-unsafe", /escapes the package root/);
  });

  test("an absolute entry path is rejected", () => {
    const files = pkg(VALID_MANIFEST);
    files.set("/etc/passwd", enc.encode("x"));
    expectRejection(files, "path-unsafe", /escapes the package root/);
  });
});
