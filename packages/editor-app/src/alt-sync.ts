/**
 * Dual-write helpers for AssetRef + sibling alt fields (scope D handoff).
 *
 * User-facing alt text lives on a sibling string (`backgroundAlt`,
 * `authorImageAlt`, `events[].imageAlt`, `org.logoAlt`, `images[].alt`).
 * `AssetRef.alt` stays in sync so the upload pipeline, renderer, and
 * validation see one description.
 */
import type { AssetRefLike } from "@sosb/schema";

import { getAtPath, setAtPath } from "./get-set-path.js";

export interface AltSyncPatch {
  readonly path: readonly (string | number)[];
  readonly value: unknown;
}

const SIBLING_ALT_TO_ASSET: Readonly<Record<string, string>> = {
  backgroundAlt: "backgroundImage",
  authorImageAlt: "authorImage",
  imageAlt: "image",
  logoAlt: "logo",
};

const ASSET_TO_SIBLING_ALT: Readonly<Record<string, string>> = {
  backgroundImage: "backgroundAlt",
  authorImage: "authorImageAlt",
  image: "imageAlt",
  logo: "logoAlt",
};

function isAssetRefLike(value: unknown): value is AssetRefLike {
  if (typeof value !== "object" || value === null) return false;
  const path = (value as { path?: unknown }).path;
  return typeof path === "string" && path.length > 0;
}

function withAlt(ref: AssetRefLike, alt: string): AssetRefLike {
  return { ...ref, alt };
}

/**
 * Given a patch into block/spine data, return the primary patch plus any
 * companion patches required to keep sibling alt and `AssetRef.alt` aligned.
 */
export function expandAltSyncPatches(
  dataRoot: unknown,
  path: readonly (string | number)[],
  value: unknown,
): readonly AltSyncPatch[] {
  const patches: AltSyncPatch[] = [{ path, value }];
  const last = path[path.length - 1];
  if (typeof last !== "string") return patches;

  const siblingAltKey = SIBLING_ALT_TO_ASSET[last];
  if (siblingAltKey !== undefined) {
    const assetPath = [...path.slice(0, -1), siblingAltKey];
    const asset = getAtPath(dataRoot, assetPath);
    if (isAssetRefLike(asset)) {
      const alt = typeof value === "string" ? value : "";
      patches.push({ path: assetPath, value: withAlt(asset, alt) });
    }
    return patches;
  }

  const siblingFromAsset = ASSET_TO_SIBLING_ALT[last];
  if (siblingFromAsset !== undefined) {
    const altPath = [...path.slice(0, -1), siblingFromAsset];
    if (value === undefined) {
      patches.push({ path: altPath, value: undefined });
    } else if (isAssetRefLike(value)) {
      patches.push({ path: altPath, value: value.alt });
    }
    return patches;
  }

  if (last === "alt") {
    const assetPath = [...path.slice(0, -1), "asset"];
    const asset = getAtPath(dataRoot, assetPath);
    if (isAssetRefLike(asset)) {
      const alt = typeof value === "string" ? value : "";
      patches.push({ path: assetPath, value: withAlt(asset, alt) });
    }
    return patches;
  }

  if (last === "asset") {
    const altPath = [...path.slice(0, -1), "alt"];
    if (value === undefined) {
      patches.push({ path: altPath, value: undefined });
    } else if (isAssetRefLike(value)) {
      patches.push({ path: altPath, value: value.alt });
    }
  }

  return patches;
}

/** Sibling alt string to pass into upload when replacing an existing image. */
export function suggestedAltForAssetPath(
  dataRoot: unknown,
  assetPath: readonly (string | number)[],
): string | undefined {
  const last = assetPath[assetPath.length - 1];
  if (typeof last !== "string") return undefined;

  const siblingKey = ASSET_TO_SIBLING_ALT[last];
  if (siblingKey !== undefined) {
    const sibling = getAtPath(dataRoot, [...assetPath.slice(0, -1), siblingKey]);
    if (typeof sibling === "string" && sibling.trim().length > 0) return sibling;
  }

  if (last === "asset") {
    const sibling = getAtPath(dataRoot, [...assetPath.slice(0, -1), "alt"]);
    if (typeof sibling === "string" && sibling.trim().length > 0) return sibling;
  }

  return undefined;
}

export function applyAltSyncPatches(
  data: Record<string, unknown>,
  patches: readonly AltSyncPatch[],
): Record<string, unknown> {
  const draft = structuredClone(data) as Record<string, unknown>;
  for (const patch of patches) {
    setAtPath(draft, patch.path, patch.value);
  }
  return draft;
}

/**
 * Document known asset ↔ sibling-alt path pairs for tests and tooling.
 */
export function pairedAltPaths(
  assetPath: readonly (string | number)[],
):
  | { assetPath: readonly (string | number)[]; siblingAltPath: readonly (string | number)[] }
  | undefined {
  const last = assetPath[assetPath.length - 1];
  if (typeof last !== "string") return undefined;

  const siblingKey = ASSET_TO_SIBLING_ALT[last];
  if (siblingKey !== undefined) {
    return {
      assetPath,
      siblingAltPath: [...assetPath.slice(0, -1), siblingKey],
    };
  }

  if (last === "asset") {
    return {
      assetPath,
      siblingAltPath: [...assetPath.slice(0, -1), "alt"],
    };
  }

  return undefined;
}
