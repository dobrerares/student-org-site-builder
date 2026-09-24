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
import { THEME_PACKAGE_MAX_BYTES, ThemePackageError, loadThemePackage } from "../src/index.js";

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

  test("preserves unknown manifest keys so a future package still parses", () => {
    // ADR 0050's forward-compatibility rule: a package carrying keys this
    // builder has never heard of must load, not be rejected as malformed.
    // (`render` and `public` stopped being unknown in phase two — ADR 0054 —
    // and `blocks` with Custom Blocks — ADR 0055; all three are validated now,
    // see render-modules.test.ts and custom-blocks.test.ts.)
    const { manifest } = loadThemePackage(
      pkg({ ...VALID_MANIFEST, widgets: [{ type: "x/y" }], preview: { swatches: [] } }),
    );
    expect((manifest as unknown as { widgets?: unknown }).widgets).toEqual([{ type: "x/y" }]);
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

describe("offline enforcement cannot be spelled around", () => {
  // CSS lets you write the same token several ways. A scanner that only
  // matches the obvious spelling is a scanner that is not enforcing anything,
  // so each of these is a real escape route that must stay closed.

  test("an escaped url() keyword is rejected", () => {
    // `\75 rl(` is `url(` — a browser fetches it, a naive scanner does not
    // see it.
    expectRejection(
      pkg(VALID_MANIFEST, { "theme.css": "body{background:\\75 rl(https://cdn.example/x.png)}" }),
      "css-unsafe",
      /remote url/,
    );
  });

  test("a six-digit escaped url() keyword is rejected", () => {
    expectRejection(
      pkg(VALID_MANIFEST, {
        "theme.css": "body{background:\\000075rl(https://cdn.example/x.png)}",
      }),
      "css-unsafe",
      /remote url/,
    );
  });

  test("an escaped url() keyword around a local file is rejected too", () => {
    // Not a network request, but the renderer's rewriter would not recognise
    // it either, so it would 404 in the export. Reject at import instead.
    const files = pkg(VALID_MANIFEST, {
      "theme.css": "body{background:\\75 rl(assets/grid.svg)}",
      "assets/grid.svg": "<svg/>",
    });
    expectRejection(files, "css-unsafe", /character escapes/);
  });

  test("an @import with no space before its string is rejected", () => {
    // `@import"…";` is valid CSS and skips a scanner that requires
    // whitespace after the at-rule name.
    expectRejection(
      pkg(VALID_MANIFEST, { "theme.css": '@import"https://cdn.example/reset.css";' }),
      "css-unsafe",
      /remote @import/,
    );
  });

  test("a local @import is rejected — the loader never resolves it", () => {
    const files = pkg(VALID_MANIFEST, {
      "theme.css": '@import "other.css";',
      "other.css": "body{color:red}",
    });
    expectRejection(files, "css-unsafe", /@import is not allowed/);
  });

  test("a remote image-set() bare string is rejected", () => {
    // `image-set()` takes bare quoted strings as URLs, with no url() token.
    expectRejection(
      pkg(VALID_MANIFEST, {
        "theme.css": 'body{background-image:image-set("https://cdn.example/x.png" 1x)}',
      }),
      "css-unsafe",
      /remote image-set/,
    );
  });

  test("a url() inside a comment is not a reference", () => {
    // The mirror of the rules above: the scanner must not invent problems
    // either, or authors learn to work around it instead of with it.
    expect(() =>
      loadThemePackage(
        pkg(VALID_MANIFEST, {
          "theme.css": "/* url(https://cdn.example/old.png) */ body{color:red}",
        }),
      ),
    ).not.toThrow();
  });
});

describe("duplicate declarations", () => {
  test("a repeated variant id is rejected", () => {
    expectRejection(
      pkg({
        ...VALID_MANIFEST,
        variants: {
          hero: [
            { id: "split", label: "Split" },
            { id: "split", label: "Split again" },
          ],
        },
      }),
      "manifest-invalid",
      /variants\.hero declares variant id "split" more than once/,
    );
  });

  test("a repeated shell variant id is rejected", () => {
    expectRejection(
      pkg({
        ...VALID_MANIFEST,
        shellVariants: [
          { id: "compact", label: "Compact" },
          { id: "compact", label: "Compact too" },
        ],
      }),
      "manifest-invalid",
      /shellVariants declares shell variant id "compact" more than once/,
    );
  });

  test("two font faces with the same family, weight and style are rejected", () => {
    const files = pkg(
      {
        ...VALID_MANIFEST,
        fonts: [
          { family: "Archivo", weight: 400, style: "normal", file: "a.woff2" },
          { family: "Archivo", weight: 400, style: "normal", file: "b.woff2" },
        ],
      },
      { "theme.css": "body{color:red}", "a.woff2": "x", "b.woff2": "y" },
    );
    expectRejection(files, "manifest-invalid", /fonts declares font face .* more than once/);
  });

  test("the same family at different weights is fine", () => {
    const files = pkg(
      {
        ...VALID_MANIFEST,
        fonts: [
          { family: "Archivo", weight: 400, style: "normal", file: "a.woff2" },
          { family: "Archivo", weight: 700, style: "normal", file: "b.woff2" },
        ],
      },
      { "theme.css": "body{color:red}", "a.woff2": "x", "b.woff2": "y" },
    );
    expect(() => loadThemePackage(files)).not.toThrow();
  });
});

describe("size limit", () => {
  test("an oversized package is rejected before anything else is read", () => {
    // Checked ahead of the manifest on purpose: the point of the ceiling is to
    // avoid chewing through a hostile or accidental 500 MB archive, and
    // parsing first would defeat it. The fixture here has a perfectly valid
    // manifest, so a rejection can only come from the size check.
    const files = pkg(VALID_MANIFEST, {
      "theme.css": "body{color:red}",
      "fonts/huge.woff2": new Uint8Array(THEME_PACKAGE_MAX_BYTES + 1),
    });
    expectRejection(files, "package-too-large", /over the .* limit/);
  });

  test("a package just under the ceiling still loads", () => {
    const files = pkg(VALID_MANIFEST, {
      "theme.css": "body{color:red}",
      "fonts/big.woff2": new Uint8Array(1024),
    });
    expect(() => loadThemePackage(files)).not.toThrow();
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
