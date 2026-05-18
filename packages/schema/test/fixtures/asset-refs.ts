/** Shared AssetRef shapes for schema tests (matches renderer fixture hashes). */
export const historipolLogoRef = {
  hash: "8e3a7f",
  path: "assets/8e3a7f.png",
  metadataPath: "assets/8e3a7f.metadata.json",
  mime: "image/png" as const,
  width: 320,
  height: 120,
  alt: "Sigla Asociației Studențească HISTORIPOL",
};

export const historipolHeroBgRef = {
  hash: "4a91d2",
  path: "assets/4a91d2.jpg",
  metadataPath: "assets/4a91d2.metadata.json",
  mime: "image/jpeg" as const,
  width: 1600,
  height: 1067,
  alt: "Studenți la o conferință de istorie în aula universității",
};

/** Minimal AssetRef for fixtures that only had a path string. */
export function assetRefFromPath(
  vfsPath: string,
  alt: string,
  mime: "image/jpeg" | "image/png" | "image/webp" | "image/svg+xml" = "image/jpeg",
): typeof historipolHeroBgRef {
  const base = vfsPath.replace(/^assets\//, "").replace(/\.[^.]+$/, "");
  return {
    hash: base,
    path: vfsPath,
    metadataPath: `assets/${base}.metadata.json`,
    mime,
    width: 1600,
    height: 1067,
    alt,
  };
}
