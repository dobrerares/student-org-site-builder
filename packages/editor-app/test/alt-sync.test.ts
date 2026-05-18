import { describe, expect, test } from "vitest";
import {
  applyAltSyncPatches,
  expandAltSyncPatches,
  pairedAltPaths,
  suggestedAltForAssetPath,
} from "../src/alt-sync.js";

const heroData = {
  title: "Welcome",
  backgroundImage: {
    hash: "4a91d2",
    path: "assets/4a91d2.jpg",
    metadataPath: "assets/4a91d2.metadata.json",
    mime: "image/jpeg",
    width: 1600,
    height: 1067,
    alt: "Old ref alt",
  },
  backgroundAlt: "User-facing alt",
};

describe("alt-sync", () => {
  test("pairedAltPaths maps hero backgroundImage to backgroundAlt", () => {
    expect(pairedAltPaths(["backgroundImage"])).toEqual({
      assetPath: ["backgroundImage"],
      siblingAltPath: ["backgroundAlt"],
    });
  });

  test("patching backgroundAlt updates backgroundImage.alt", () => {
    const patches = expandAltSyncPatches(heroData, ["backgroundAlt"], "New alt");
    const next = applyAltSyncPatches(heroData as Record<string, unknown>, patches);
    expect(next.backgroundAlt).toBe("New alt");
    expect((next.backgroundImage as { alt: string }).alt).toBe("New alt");
  });

  test("patching backgroundImage updates backgroundAlt and uses ref.alt", () => {
    const ref = {
      hash: "abc",
      path: "assets/abc.jpg",
      metadataPath: "assets/abc.metadata.json",
      mime: "image/jpeg" as const,
      width: 1,
      height: 1,
      alt: "From upload",
    };
    const patches = expandAltSyncPatches(heroData, ["backgroundImage"], ref);
    const next = applyAltSyncPatches(heroData as Record<string, unknown>, patches);
    expect(next.backgroundAlt).toBe("From upload");
    expect(next.backgroundImage).toEqual(ref);
  });

  test("clearing backgroundImage clears backgroundAlt", () => {
    const patches = expandAltSyncPatches(heroData, ["backgroundImage"], undefined);
    const next = applyAltSyncPatches(heroData as Record<string, unknown>, patches);
    expect(next.backgroundImage).toBeUndefined();
    expect(next.backgroundAlt).toBeUndefined();
  });

  test("gallery images[].alt syncs to images[].asset.alt", () => {
    const data = {
      images: [
        {
          asset: {
            hash: "x",
            path: "assets/x.jpg",
            metadataPath: "assets/x.metadata.json",
            mime: "image/jpeg",
            width: 1,
            height: 1,
            alt: "asset alt",
          },
          alt: "gallery alt",
        },
      ],
    };
    const patches = expandAltSyncPatches(data, ["images", 0, "alt"], "Updated");
    const next = applyAltSyncPatches(data as Record<string, unknown>, patches);
    expect((next.images as { alt: string }[])[0]!.alt).toBe("Updated");
    expect(((next.images as { asset: { alt: string } }[])[0]!.asset).alt).toBe("Updated");
  });

  test("suggestedAltForAssetPath reads sibling alt", () => {
    expect(suggestedAltForAssetPath(heroData, ["backgroundImage"])).toBe("User-facing alt");
  });
});
