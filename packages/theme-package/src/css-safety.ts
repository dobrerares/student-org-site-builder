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
 */

import { ThemePackageError } from "./errors.js";

/** `url(...)` token, capturing the body without quotes. */
const URL_TOKEN_RE = /url\(\s*(['"]?)([^'")]*)\1\s*\)/gi;

/** `@import` prelude, up to the terminating `;`. */
const IMPORT_RE = /@import\s+([^;]*);/gi;

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

/**
 * Throw if the stylesheet reaches for the network or escapes the package.
 *
 * @param css  the stylesheet source
 * @param at   file path used in error messages
 */
export function assertThemeCssIsOffline(css: string, at: string): void {
  for (const match of css.matchAll(IMPORT_RE)) {
    const prelude = match[1] ?? "";
    // An @import's target is either a url() token or a bare quoted string.
    const urlMatch = /url\(\s*(['"]?)([^'")]*)\1\s*\)/i.exec(prelude);
    const bareString = /^\s*(['"])([^'"]*)\1/.exec(prelude);
    const target = urlMatch?.[2] ?? bareString?.[2] ?? "";
    if (isRemoteTarget(target)) {
      throw new ThemePackageError(
        "css-unsafe",
        `${at}: remote @import of "${target.trim()}" is not allowed. ` +
          `Theme packages must render offline — bundle the stylesheet or font inside the package.`,
        at,
      );
    }
  }

  for (const match of css.matchAll(URL_TOKEN_RE)) {
    const target = (match[2] ?? "").trim();
    if (target.length === 0) continue;
    if (isRemoteTarget(target)) {
      throw new ThemePackageError(
        "css-unsafe",
        `${at}: remote url("${target}") is not allowed. ` +
          `Theme packages must render offline — bundle the file under assets/ and reference it relatively.`,
        at,
      );
    }
    if (target.startsWith("data:") || target.startsWith("blob:") || target.startsWith("#"))
      continue;
    if (target.startsWith("/")) {
      throw new ThemePackageError(
        "css-unsafe",
        `${at}: absolute url("${target}") is not allowed. ` +
          `Reference packaged files relatively, e.g. url(assets/grid.svg).`,
        at,
      );
    }
    if (target.includes("..") || target.includes("\\")) {
      throw new ThemePackageError(
        "path-unsafe",
        `${at}: url("${target}") escapes the package. ` +
          `Reference packaged files relatively, without '..' or backslashes.`,
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
 */
export function referencedLocalUrls(css: string): string[] {
  const found = new Set<string>();
  for (const match of css.matchAll(URL_TOKEN_RE)) {
    const target = (match[2] ?? "").trim();
    if (target.length === 0) continue;
    if (isRemoteTarget(target)) continue;
    if (target.startsWith("data:") || target.startsWith("blob:")) continue;
    if (target.startsWith("#") || target.startsWith("/")) continue;
    found.add(target.startsWith("./") ? target.slice(2) : target);
  }
  return [...found].sort();
}
