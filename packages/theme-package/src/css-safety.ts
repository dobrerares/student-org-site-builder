/**
 * Offline enforcement for Theme CSS (ADR 0046, ADR 0050).
 *
 * ADR 0046 permits Themes arbitrary CSS, and also requires that preview and
 * export render identically, offline, in the browser and in Electron. Those
 * two requirements collide in exactly one place: a stylesheet that fetches
 * something. `@import url(https://fonts.example/…)` or
 * `background: url(https://cdn.example/hero.jpg)` turns the rendered page into
 * a function of the network, so the same Site renders differently on a train
 * than in the office, and an archived Site decays as third-party URLs rot.
 *
 * ADR 0046 says the builder must *enforce* the rendering access limits rather
 * than trust authors to follow documentation. This is that enforcement for the
 * declarative phase: we reject the package at import time, when the author is
 * present and can fix it, rather than at render time in front of a student.
 *
 * The check is deliberately a conservative scanner rather than a full CSS
 * parser. A parser would be more precise, but the failure modes point opposite
 * ways: a scanner's mistake rejects a package the author can trivially reword;
 * a parser's mistake ships a network request we promised would not exist. We
 * take the noisy side. Everything rejected here has a local equivalent —
 * bundle the font, bundle the image.
 *
 * A scanner over raw source is only conservative if it cannot be spelled
 * around, and CSS offers two spellings of everything: comments in the middle
 * of a token, and character escapes (`\75 rl(…)` is `url(…)`; `\40 import` is
 * `@import`). So every check below runs over a *normalised* copy — comments
 * removed, escapes decoded — and a final check rejects any `url()` that only
 * exists in the normalised copy. That last rule matters twice over: an escaped
 * `url()` is both a way past this scanner and a token the renderer's asset
 * rewriter would not recognise, so it would 404 at render time even if it were
 * honest.
 */

import { ThemePackageError } from "./errors.js";

/** `url(...)` token, capturing the body without quotes. */
const URL_TOKEN_RE = /url\(\s*(['"]?)([^'")]*)\1\s*\)/gi;

/**
 * Any `@import`, however its target is spelled. A Theme package ships exactly
 * one stylesheet (`manifest.css`), so there is no honest `@import` here: a
 * remote one breaks the offline guarantee, and a *local* one is never resolved
 * by the loader — it would silently resolve against the rendered page's URL
 * and 404. Both get rejected, with different wording.
 */
const IMPORT_RE = /@import\b([^;{]*)[;{]?/gi;

/** `image-set()` accepts bare quoted strings as URLs, with no `url()` token. */
const IMAGE_SET_RE = /(?:-webkit-)?image-set\(([^)]*)\)/gi;

/** Quoted string literal, capturing the body. */
const STRING_RE = /(['"])((?:[^'"\\]|\\.)*)\1/g;

/** Schemes that reach off-device. `data:` and `blob:` stay local. */
const REMOTE_SCHEME_RE = /^(?:[a-z][a-z0-9+.-]*:)?\/\//i;

function isRemoteTarget(target: string): boolean {
  const t = target.trim();
  if (t.length === 0) return false;
  if (REMOTE_SCHEME_RE.test(t)) return true;
  // Any explicit scheme other than the two local ones we allow.
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(t);
  if (scheme !== null) {
    const name = scheme[1]!.toLowerCase();
    return name !== "data" && name !== "blob";
  }
  return false;
}

/** Replace comments with a space, so `ur/*x*\/l(` cannot hide a token. */
function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, " ");
}

/**
 * Decode CSS character escapes (`\75`, `\000075 `, `\:`) so the scanner sees
 * the token the browser would see. Applied only to the copy we scan — the
 * bytes we ship are never rewritten.
 */
function decodeCssEscapes(css: string): string {
  return css.replace(
    /\\(?:([0-9a-fA-F]{1,6})[ \t\n\r\f]?|([\s\S]))/g,
    (whole, hex?: string, ch?: string) => {
      if (hex !== undefined) {
        const codePoint = Number.parseInt(hex, 16);
        if (codePoint === 0 || codePoint > 0x10ffff) return "�";
        return String.fromCodePoint(codePoint);
      }
      return ch ?? whole;
    },
  );
}

/** The scanner's view of a stylesheet: no comments, no escapes. */
function normaliseForScan(css: string): string {
  return decodeCssEscapes(stripCssComments(css));
}

/** Every `url()` body in `css`, trimmed, in source order. */
function urlTargets(css: string): string[] {
  return [...css.matchAll(URL_TOKEN_RE)].map((match) => (match[2] ?? "").trim());
}

/**
 * Apply the location rules to one URL target. `kind` only shapes the wording,
 * so an author reading the error knows which construct to go and fix.
 */
function assertTargetIsLocal(target: string, at: string, kind: string): void {
  if (target.length === 0) return;
  if (isRemoteTarget(target)) {
    throw new ThemePackageError(
      "css-unsafe",
      `${at}: remote ${kind}("${target}") is not allowed. ` +
        `Theme packages must render offline — bundle the file under assets/ and reference it relatively.`,
      at,
    );
  }
  if (target.startsWith("data:") || target.startsWith("blob:") || target.startsWith("#")) return;
  if (target.startsWith("/")) {
    throw new ThemePackageError(
      "css-unsafe",
      `${at}: absolute ${kind}("${target}") is not allowed. ` +
        `Reference packaged files relatively, e.g. url(assets/grid.svg).`,
      at,
    );
  }
  if (target.includes("..") || target.includes("\\")) {
    throw new ThemePackageError(
      "path-unsafe",
      `${at}: ${kind}("${target}") escapes the package. ` +
        `Reference packaged files relatively, without '..' or backslashes.`,
      at,
    );
  }
}

/**
 * Throw if the stylesheet reaches for the network or escapes the package.
 *
 * @param css  the stylesheet source
 * @param at   file path used in error messages
 */
export function assertThemeCssIsOffline(css: string, at: string): void {
  const scan = normaliseForScan(css);

  for (const match of scan.matchAll(IMPORT_RE)) {
    const prelude = match[1] ?? "";
    // An @import's target is either a url() token or a bare quoted string.
    const urlMatch = /url\(\s*(['"]?)([^'")]*)\1\s*\)/i.exec(prelude);
    const bareString = /^\s*(['"])([^'"]*)\1/.exec(prelude);
    const target = (urlMatch?.[2] ?? bareString?.[2] ?? "").trim();
    if (isRemoteTarget(target)) {
      throw new ThemePackageError(
        "css-unsafe",
        `${at}: remote @import of "${target}" is not allowed. ` +
          `Theme packages must render offline — bundle the stylesheet or font inside the package.`,
        at,
      );
    }
    throw new ThemePackageError(
      "css-unsafe",
      `${at}: @import is not allowed in a Theme package. A package ships one stylesheet, ` +
        `and an @import is never resolved against the package — paste the imported rules ` +
        `into ${at} instead.`,
      at,
    );
  }

  for (const target of urlTargets(scan)) {
    assertTargetIsLocal(target, at, "url");
  }

  // `image-set()` takes bare quoted strings as URLs, with no `url()` token to
  // catch. Scan its body separately rather than treating every string literal
  // in the stylesheet as a URL, which would reject ordinary `content:` text.
  for (const match of scan.matchAll(IMAGE_SET_RE)) {
    const body = match[1] ?? "";
    for (const str of body.matchAll(STRING_RE)) {
      assertTargetIsLocal((str[2] ?? "").trim(), at, "image-set");
    }
  }

  // Anything that appears as a url() only after decoding was written with
  // escapes. Reject it: the renderer's asset rewriter matches literal `url(`
  // tokens, so an escaped one is never rewritten onto the package's asset
  // prefix and would 404 at render time even with honest intent.
  const raw = stripCssComments(css);
  const rawTargets = new Set(urlTargets(raw));
  for (const target of urlTargets(scan)) {
    if (!rawTargets.has(target)) {
      throw new ThemePackageError(
        "css-unsafe",
        `${at}: url("${target}") is written with CSS character escapes. ` +
          `Write packaged references as plain text, e.g. url(assets/grid.svg).`,
        at,
      );
    }
  }
}

/**
 * The relative `url()` targets a stylesheet references, deduplicated and
 * sorted. The loader uses this to check that every referenced file is
 * actually in the package — a missing decorative image is a broken design, and
 * catching it at import beats discovering it after export.
 *
 * Reads the same text the renderer's rewriter will: comments removed (a url in
 * a comment is not a reference) but escapes left alone, because
 * `assertThemeCssIsOffline` has already rejected escaped url() tokens.
 */
export function referencedLocalUrls(css: string): string[] {
  const found = new Set<string>();
  for (const target of urlTargets(stripCssComments(css))) {
    if (target.length === 0) continue;
    if (isRemoteTarget(target)) continue;
    if (target.startsWith("data:") || target.startsWith("blob:")) continue;
    if (target.startsWith("#") || target.startsWith("/")) continue;
    found.add(target.startsWith("./") ? target.slice(2) : target);
  }
  return [...found].sort();
}
