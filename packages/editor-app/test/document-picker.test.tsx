// @vitest-environment jsdom
/**
 * Tests for the DocumentPicker component — the upload-only document-
 * asset widget that replaces the auto-generated hash/path/mime/
 * metadataPath/byteSize text fieldset for `DocumentAssetRefSchema`
 * (ADR 0043, ADR 0044).
 *
 * Per ADR 0044 Corollary 2 the empty state never falls back to raw
 * `<input>` controls. The ONLY `<input>` the component is allowed to
 * render is the hidden `<input type="file">` that drives the upload
 * affordance — every other field on the underlying DocumentAssetRef
 * (hash, mime, path, metadataPath, byteSize) is derived by the upload
 * pipeline and not human-edited.
 */
import { describe, expect, test, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/preact";

import { DocumentPicker, type DocumentAssetRefLike } from "../src/document-picker.js";

const SAMPLE_PDF: DocumentAssetRefLike = {
  hash: "abc123",
  path: "assets/abc123.pdf",
  metadataPath: "assets/abc123.metadata.json",
  mime: "application/pdf",
  byteSize: 1024 * 1024 * 2 + 512 * 1024, // 2.5 MB
};

function freshDocument(): DocumentAssetRefLike {
  return {
    hash: "def456",
    path: "assets/def456.docx",
    metadataPath: "assets/def456.metadata.json",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    byteSize: 64 * 1024, // 64 KB
  };
}

function nonFileInputs(root: ParentNode): Element[] {
  return Array.from(root.querySelectorAll("input")).filter(
    (el) => (el as HTMLInputElement).type !== "file",
  );
}

describe("DocumentPicker", () => {
  afterEach(() => cleanup());

  test("with a value, renders document icon, filename, type label, byte size — no text inputs", () => {
    const { container } = render(
      <DocumentPicker value={SAMPLE_PDF} onChange={() => {}} uploader={async () => SAMPLE_PDF} />,
    );
    // Icon present.
    expect(container.querySelector('[data-testid="document-picker-icon"]')).not.toBeNull();
    // Filename derived from VFS path (last segment).
    const filename = container.querySelector('[data-testid="document-picker-filename"]');
    expect(filename).not.toBeNull();
    expect(filename!.textContent).toBe("abc123.pdf");
    // Type label is the human-readable MIME shorthand.
    const typeLabel = container.querySelector('[data-testid="document-picker-type"]');
    expect(typeLabel).not.toBeNull();
    expect(typeLabel!.textContent).toBe("PDF");
    // Byte size in KB/MB units.
    const size = container.querySelector('[data-testid="document-picker-size"]');
    expect(size).not.toBeNull();
    expect(size!.textContent).toContain("MB");
    // NO `<img>` thumbnail — documents have no thumbnail.
    expect(container.querySelector("img")).toBeNull();
    // ADR 0044: no text/number/etc. inputs.
    expect(nonFileInputs(container)).toHaveLength(0);
  });

  test("with a value, clicking 'Replace document' opens the file picker", () => {
    const { container } = render(
      <DocumentPicker value={SAMPLE_PDF} onChange={() => {}} uploader={async () => SAMPLE_PDF} />,
    );
    const fileInput = container.querySelector(
      '[data-testid="document-picker-file-input"]',
    ) as HTMLInputElement;
    expect(fileInput).not.toBeNull();
    // Spy on the click so we can verify "Replace document" triggers it.
    const clickSpy = vi.spyOn(fileInput, "click");
    const replaceButton = container.querySelector(
      '[data-testid="document-picker-replace"]',
    ) as HTMLElement;
    expect(replaceButton).not.toBeNull();
    fireEvent.click(replaceButton);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  test("with undefined value, shows an 'Add document' CTA and no text inputs", () => {
    const { container } = render(
      <DocumentPicker
        value={undefined}
        onChange={() => {}}
        uploader={async () => freshDocument()}
      />,
    );
    const add = container.querySelector('[data-testid="document-picker-add"]');
    expect(add).not.toBeNull();
    expect(add!.textContent?.toLowerCase()).toContain("add document");
    expect(container.querySelector('[data-testid="document-picker-tile"]')).toBeNull();
    expect(nonFileInputs(container)).toHaveLength(0);
  });

  test("clicking the upload affordance and selecting a file calls uploader and propagates onChange", async () => {
    const uploaded = freshDocument();
    const uploader = vi.fn().mockResolvedValue(uploaded);
    const onChange = vi.fn();

    const { container } = render(
      <DocumentPicker value={undefined} onChange={onChange} uploader={uploader} />,
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toBeNull();

    const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "report.pdf", {
      type: "application/pdf",
    });
    // Stash the FileList on the input — jsdom can't synthesise it from
    // a bare event.
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
    const failingUploader = vi.fn().mockRejectedValue(new Error("document too large"));
    const { container } = render(
      <DocumentPicker value={undefined} onChange={() => {}} uploader={failingUploader} />,
    );
    const addBtn = container.querySelector('[data-testid="document-picker-add"]') as HTMLElement;
    addBtn.click();
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const fakeFile = new File(["x"], "x.pdf", { type: "application/pdf" });
    Object.defineProperty(fileInput, "files", { value: [fakeFile], writable: false });
    fireEvent.change(fileInput);

    await Promise.resolve();
    await Promise.resolve();

    const errorBanner = container.querySelector('[data-testid="document-picker-error"]');
    expect(errorBanner).not.toBeNull();
    expect(errorBanner?.getAttribute("data-error-message")).toContain("document too large");
  });

  test("ADR 0044: NO code path renders any <input> other than <input type='file'>", () => {
    // Render every state in turn and assert the invariant each time.
    const uploader = async (): Promise<DocumentAssetRefLike> => freshDocument();

    // 1. With value.
    const tile = render(
      <DocumentPicker value={SAMPLE_PDF} onChange={() => {}} uploader={uploader} />,
    );
    expect(nonFileInputs(tile.container)).toHaveLength(0);
    tile.unmount();

    // 2. Empty state.
    const empty = render(
      <DocumentPicker value={undefined} onChange={() => {}} uploader={uploader} />,
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
