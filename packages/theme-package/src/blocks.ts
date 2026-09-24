/**
 * Custom Block declarations inside a Theme package (ADR 0055).
 *
 * A package lists its `block.json` files in the manifest (`blocks: [...]`).
 * Each is parsed through `@sosb/schema`'s declaration schema at import time,
 * so a developer hears about an unsupported field kind while importing — with
 * the file and the field named — and never after an author has opened the
 * Inspector. A rejected package changes nothing (ADR 0051): the previously
 * installed version, and every Block authored against it, keeps working.
 *
 * The second half of this module reads declarations *leniently*. When a
 * package will not load — it needs a newer builder, or a declaration is
 * invalid — the editor still has to say something useful about the Blocks
 * that depend on it. `declaredCustomBlockTypes` reads only the `type` field of
 * each listed `block.json`, without validating anything else, which is enough
 * to turn "this block's package is missing" into "this block's package needs a
 * newer builder" (issue-106 plan, "extension requires a newer builder").
 */

import type { CustomBlockDeclaration } from "@sosb/schema";
import { isCustomBlockType, parseCustomBlockDeclaration } from "@sosb/schema";
import { ThemePackageError } from "./errors.js";
import type { ThemeManifest } from "./manifest.js";

const decoder = new TextDecoder("utf-8", { fatal: false });

function readJson(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(decoder.decode(bytes));
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Parse every declaration the manifest lists. Throws `ThemePackageError`
 * naming the file and the problem; a format-version mismatch gets its own
 * code so the editor can say "update the builder" rather than "bad package".
 */
export function loadCustomBlockDeclarations(
  manifest: ThemeManifest,
  files: ReadonlyMap<string, Uint8Array>,
): CustomBlockDeclaration[] {
  const declarations: CustomBlockDeclaration[] = [];
  const seen = new Map<string, string>();
  for (const path of manifest.blocks) {
    const bytes = files.get(path);
    if (bytes === undefined) {
      throw new ThemePackageError(
        "file-missing",
        `The manifest lists "${path}" as a Custom Block declaration, but the package does not contain it.`,
        path,
      );
    }
    const raw = readJson(bytes);
    if (raw === undefined) {
      throw new ThemePackageError("block-invalid", `${path} is not valid JSON.`, path);
    }
    const result = parseCustomBlockDeclaration(raw);
    if (!result.ok) {
      throw new ThemePackageError(
        result.code === "format-version-unsupported" ? "block-format-unsupported" : "block-invalid",
        `${path}: ${result.message}`,
        result.at === undefined ? path : `${path}#${result.at}`,
      );
    }
    const previous = seen.get(result.declaration.type);
    if (previous !== undefined) {
      throw new ThemePackageError(
        "block-invalid",
        `${path} declares the Custom Block type "${result.declaration.type}", which "${previous}" in the same package already declares. Each type is declared once.`,
        path,
      );
    }
    seen.set(result.declaration.type, path);
    declarations.push(result.declaration);
  }
  return declarations;
}

/**
 * The Custom Block type ids a package's files point at, read without
 * validation. Answers `[]` for anything unreadable: this is a best-effort
 * label for an error message, never a source of truth.
 */
export function declaredCustomBlockTypes(files: ReadonlyMap<string, Uint8Array>): string[] {
  const manifestBytes = files.get("theme.json");
  if (manifestBytes === undefined) return [];
  // `null` is valid JSON too: every read is guarded as an object, because
  // this runs while reporting a package that already failed to load and must
  // not fail itself (ADR 0051: a damaged package never stops a Site opening).
  const manifest = readJson(manifestBytes);
  if (!isRecord(manifest) || !Array.isArray(manifest["blocks"])) return [];
  const types = new Set<string>();
  for (const entry of manifest["blocks"] as unknown[]) {
    if (typeof entry !== "string") continue;
    const bytes = files.get(entry);
    if (bytes === undefined) continue;
    const raw = readJson(bytes);
    const type = isRecord(raw) ? raw["type"] : undefined;
    if (typeof type === "string" && isCustomBlockType(type)) types.add(type);
  }
  return [...types].sort();
}
