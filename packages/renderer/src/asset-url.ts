export type AssetUrlForPath = (path: string) => string | undefined;

export function resolveAssetUrl(
  path: string,
  assetUrlForPath: AssetUrlForPath | undefined,
): string {
  return assetUrlForPath?.(path) ?? path;
}
