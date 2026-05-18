/** Read a VFS path from an AssetRef-shaped value (tolerant for looseObject data). */
export function assetRefPath(ref: unknown): string | undefined {
  if (typeof ref !== "object" || ref === null) return undefined;
  const path = (ref as { path?: unknown }).path;
  return typeof path === "string" && path.length > 0 ? path : undefined;
}

/** Read alt from an AssetRef-shaped value. */
export function assetRefAlt(ref: unknown): string {
  if (typeof ref !== "object" || ref === null) return "";
  const alt = (ref as { alt?: unknown }).alt;
  return typeof alt === "string" ? alt : "";
}
