// @vitest-environment jsdom
/**
 * Tests for the AssetPicker component — the upload-only image-asset
 * widget that replaces the auto-generated hash/mime/path text fieldset
 * (ADR 0043, ADR 0044).
 *
 * Per ADR 0044 Corollary 2 the empty state never falls back to raw
 * `<input>` controls. The ONLY `<input>` the component is allowed to
 * render is the hidden `<input type="file">` that drives the upload
 * affordance — every other field on the underlying AssetRef
 * (hash, mime, path, metadataPath, width, height) is derived by the
 * upload pipeline and not human-edited.
 */
import { describe, expect, test, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/preact";
import type { AssetRefLike } from "@sosb/schema";

import { AssetPicker } from "../src/asset-picker.js";

const SAMPLE_ASSET: AssetRefLike = {
  hash: "abc123",
  path: "/vfs/abc123.jpg",
  metadataPath: "/vfs/abc123.metadata.json",
  mime: "image/jpeg",
  width: 800,
  height: 600,
  alt: "A sample image",
};

function freshAsset(): AssetRefLike {
  return {
    hash: "def456",
    path: "/vfs/def456.jpg",
    metadataPath: "/vfs/def456.metadata.json",
    mime: "image/jpeg",
    width: 400,
    height: 300,
    alt: "",
  };
}

function nonFileInputs(root: ParentNode): Element[] {
  return Array.from(root.querySelectorAll("input")).filter(
    (el) => (el as HTMLInputElement).type !== "file",
  );
}

describe("AssetPicker", () => {
  afterEach(() => cleanup());

  test("with a value, renders a thumbnail <img src={value.path}> and no text inputs", () => {
    const { container } = render(
      <AssetPicker
        value={SAMPLE_ASSET}
        onChange={() => {}}
        uploader={async () => SAMPLE_ASSET}
      />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toBe(SAMPLE_ASSET.path);
    expect(img!.getAttribute("alt")).toBe(SAMPLE_ASSET.alt);
    // ADR 0044: no text/number/etc. inputs.
    expect(nonFileInputs(container)).toHaveLength(0);
  });

  test("with undefined value, shows an 'Add image' CTA and no text inputs", () => {
    const { container } = render(
      <AssetPicker
        value={undefined}
        onChange={() => {}}
        uploader={async () => freshAsset()}
      />,
    );
    const add = container.querySelector('[data-testid="asset-picker-add"]');
    expect(add).not.toBeNull();
    expect(add!.textContent?.toLowerCase()).toContain("add image");
    expect(container.querySelector("img")).toBeNull();
    expect(nonFileInputs(container)).toHaveLength(0);
  });

  test("when the value's image fails to load, shows a 'missing asset' state with a re-upload button", () => {
    const { container } = render(
      <AssetPicker
        value={SAMPLE_ASSET}
        onChange={() => {}}
        uploader={async () => freshAsset()}
      />,
    );
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img).not.toBeNull();

    // jsdom doesn't fire onError organically — simulate it.
    fireEvent.error(img);

    const missing = container.querySelector('[data-testid="asset-picker-missing"]');
    expect(missing).not.toBeNull();
    expect(missing!.textContent?.toLowerCase()).toContain("missing");

    const reupload = container.querySelector('[data-testid="asset-picker-reupload"]');
    expect(reupload).not.toBeNull();

    // No raw inputs even in the missing-asset fallback.
    expect(nonFileInputs(container)).toHaveLength(0);
  });

  test("clicking the upload affordance and selecting a file calls uploader and propagates onChange", async () => {
    const uploaded = freshAsset();
    const uploader = vi.fn().mockResolvedValue(uploaded);
    const onChange = vi.fn();

    const { container } = render(
      <AssetPicker value={undefined} onChange={onChange} uploader={uploader} />,
    );

    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(fileInput).not.toBeNull();

    const file = new File([new Uint8Array([0xff, 0xd8])], "test.jpg", {
      type: "image/jpeg",
    });
    // Stash the FileList on the input — jsdom can't synthesise it from a
    // bare event.
    Object.defineProperty(fileInput, "files", {
      value: [file],
      configurable: true,
    });
    fireEvent.change(fileInput);

    // The component awaits the uploader; flush microtasks.
    await Promise.resolve();
    await Promise.resolve();

    expect(uploader).toHaveBeenCalledTimes(1);
    expect(uploader).toHaveBeenCalledWith(file);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(uploaded);
  });

  test("renders an upload error banner when the uploader rejects", async () => {
    const failingUploader = vi.fn().mockRejectedValue(new Error("network down"));
    const { container } = render(
      <AssetPicker value={undefined} onChange={() => {}} uploader={failingUploader} />,
    );
    const addBtn = container.querySelector('[data-testid="asset-picker-add"]') as HTMLElement;
    addBtn.click();
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const fakeFile = new File(["x"], "x.jpg", { type: "image/jpeg" });
    Object.defineProperty(fileInput, "files", { value: [fakeFile], writable: false });
    fireEvent.change(fileInput);

    await Promise.resolve();
    await Promise.resolve();

    const errorBanner = container.querySelector('[data-testid="asset-picker-error"]');
    expect(errorBanner).not.toBeNull();
    expect(errorBanner?.getAttribute("data-error-message")).toContain("network down");
  });

  test("ignores a stale upload that resolves after a newer one", async () => {
    let resolveA!: (v: AssetRefLike) => void;
    const aPromise = new Promise<AssetRefLike>((r) => (resolveA = r));
    const bRef: AssetRefLike = {
      hash: "B",
      mime: "image/jpeg",
      path: "/vfs/B.jpg",
      metadataPath: "/vfs/B.json",
      width: 100,
      height: 100,
      alt: "B",
    };
    const aRef: AssetRefLike = {
      hash: "A",
      mime: "image/jpeg",
      path: "/vfs/A.jpg",
      metadataPath: "/vfs/A.json",
      width: 100,
      height: 100,
      alt: "A",
    };

    let callCount = 0;
    const uploader = vi.fn().mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) return aPromise;
      return Promise.resolve(bRef);
    });

    const received: AssetRefLike[] = [];
    const { container } = render(
      <AssetPicker value={undefined} onChange={(v) => received.push(v)} uploader={uploader} />,
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const trigger = (name: string): void => {
      const file = new File(["x"], name, { type: "image/jpeg" });
      Object.defineProperty(fileInput, "files", {
        value: [file],
        writable: false,
        configurable: true,
      });
      fireEvent.change(fileInput);
    };

    trigger("A.jpg");
    trigger("B.jpg");

    await Promise.resolve();
    await Promise.resolve();

    resolveA(aRef);
    await Promise.resolve();
    await Promise.resolve();

    expect(received).toEqual([bRef]);
  });

  test("ADR 0044: NO code path renders any <input> other than <input type='file'>", () => {
    // Render every state in turn and assert the invariant each time.
    const uploader = async (): Promise<AssetRefLike> => freshAsset();

    // 1. With value + image OK.
    const ok = render(
      <AssetPicker value={SAMPLE_ASSET} onChange={() => {}} uploader={uploader} />,
    );
    expect(nonFileInputs(ok.container)).toHaveLength(0);
    ok.unmount();

    // 2. With value + image errored.
    const errored = render(
      <AssetPicker value={SAMPLE_ASSET} onChange={() => {}} uploader={uploader} />,
    );
    fireEvent.error(errored.container.querySelector("img") as HTMLImageElement);
    expect(nonFileInputs(errored.container)).toHaveLength(0);
    errored.unmount();

    // 3. Empty state.
    const empty = render(
      <AssetPicker value={undefined} onChange={() => {}} uploader={uploader} />,
    );
    expect(nonFileInputs(empty.container)).toHaveLength(0);

    // And in every state the only <input> permitted is type="file".
    const allInputs = Array.from(empty.container.querySelectorAll("input"));
    for (const input of allInputs) {
      expect((input as HTMLInputElement).type).toBe("file");
    }
    empty.unmount();
  });
});
