/**
 * DocumentPicker — upload-only document-asset widget (ADR 0043, ADR 0044).
 *
 * Sibling to `AssetPicker`: same upload-only posture, same hidden-file-
 * input affordance, same ADR-0044 "no technical-field text inputs"
 * invariant. Differs only in the *type* of metadata it surfaces and the
 * shape of the schema-side reference (`DocumentAssetRefLike`, which
 * carries `byteSize`/`mime` instead of `width`/`height`/`alt`).
 *
 * Mirrors `AssetPicker`'s structure for the upload flow so the two
 * pickers stay consistent for users who hop between them: same error
 * banner copy framework, same token-guard against rapid-fire stale
 * resolutions.
 *
 * Two rendered states (the missing-asset state from `AssetPicker` is
 * omitted intentionally — documents are upload-once-and-served by the
 * VFS, not preview-loaded for display in the editor, so there is no
 * `onError` channel to drive a "missing" badge):
 *
 *  1. `value` set → a document tile showing inline document icon,
 *     filename, type label (PDF / DOCX / …), and human-readable byte
 *     size, plus a "Replace document" button that re-opens the file
 *     picker. ADR 0044 Corollary 2: never surface the underlying
 *     hash / mime / path / metadataPath / byteSize fields as text
 *     inputs.
 *  2. `value` undefined → an "Add document" CTA.
 *
 * The only `<input>` this component renders is `<input type="file">`
 * (hidden, triggered programmatically) — the standard upload affordance
 * that ADR 0044 carves out from the no-technical-fields rule. The file
 * input has NO `accept` attribute because the document pipeline
 * accepts a wide range of types (PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX,
 * ZIP, TXT, CSV, ODT, ODS); the asset pipeline does the authoritative
 * MIME check by inspecting magic bytes, so a permissive picker is OK.
 */
import type { JSX } from "preact";
import { useRef, useState } from "preact/hooks";
import type { DocumentAssetRef } from "@sosb/schema";

/**
 * Loose runtime view over `DocumentAssetRef`. Matches the schema's
 * `z.looseObject` posture: required fields plus an `[x: string]: unknown`
 * index signature so unknown future keys round-trip. The schema's
 * inferred type already carries this signature; the alias just keeps
 * the picker's call sites readable.
 */
export type DocumentAssetRefLike = DocumentAssetRef;

export interface DocumentPickerProps {
  readonly value: DocumentAssetRefLike | undefined;
  readonly onChange: (next: DocumentAssetRefLike) => void;
  /** Required: how this picker writes to the VFS. Injected so tests can mock. */
  readonly uploader: (file: File) => Promise<DocumentAssetRefLike>;
}

/**
 * Map MIME to the short type badge surfaced next to the filename. Mirrors
 * the renderer's `TYPE_LABELS_BY_MIME` (`packages/renderer/src/blocks/
 * document-downloads.tsx`) so the editor preview and the picker show the
 * same shorthand — same convention, two surfaces. Unknown MIMEs render
 * as `FILE`.
 */
const TYPE_LABELS_BY_MIME: Readonly<Record<string, string>> = {
  "application/pdf": "PDF",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/vnd.ms-excel": "XLS",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
  "application/vnd.ms-powerpoint": "PPT",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX",
  "application/zip": "ZIP",
  "text/plain": "TXT",
  "text/csv": "CSV",
  "application/vnd.oasis.opendocument.text": "ODT",
  "application/vnd.oasis.opendocument.spreadsheet": "ODS",
};

function typeLabelFor(mime: string | undefined): string {
  if (!mime) return "FILE";
  return TYPE_LABELS_BY_MIME[mime] ?? "FILE";
}

/**
 * Format a byte count as a short, human-readable string.
 *
 * Pinned units: B (under 1 KiB), KB (under 1 MiB), MB (≥ 1 MiB). The
 * format mirrors `formatByteSize` in the document-downloads renderer
 * so the editor (where the user picked) and the rendered preview
 * (where the user verifies) show the same number for the same file.
 * Decimal "KB/MB" labels paired with binary thresholds match the
 * convention most file managers display.
 */
function formatByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

/**
 * Derive a user-facing filename from the VFS path. The pipeline writes
 * documents to `assets/<hash>.<ext>` so the last path segment is a
 * stable, predictable string. We DON'T show the originalName here
 * because the schema doesn't carry it (it lives in the metadata
 * sidecar) — surfacing the canonical filename keeps the editor and
 * preview aligned, and the user can recognise their file from the
 * extension + type-label + byte-size triad.
 */
function filenameFor(path: string | undefined): string {
  if (!path) return "Document";
  const slash = path.lastIndexOf("/");
  return slash >= 0 ? path.slice(slash + 1) : path;
}

export function DocumentPicker(props: DocumentPickerProps): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Surface uploader failures (network down, server error, oversize
  // document, unsupported MIME) above the state-specific UI — per ADR
  // 0044's "never lose user intent silently" spirit, a rejected upload
  // MUST show feedback.
  const [uploadError, setUploadError] = useState<string | null>(null);
  // In-flight token guards against rapid-fire uploads where the earlier
  // promise resolves AFTER the later one. Only the most recent token
  // wins; superseded resolutions are silently dropped.
  const uploadTokenRef = useRef(0);

  const triggerFilePicker = (): void => {
    fileInputRef.current?.click();
  };

  const onFileChosen = async (
    event: JSX.TargetedEvent<HTMLInputElement>,
  ): Promise<void> => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (file === undefined) return;
    // Clear the input so picking the same filename twice still fires
    // onChange — otherwise the second selection is a no-op.
    input.value = "";

    const token = ++uploadTokenRef.current;
    setUploadError(null);
    try {
      const next = await props.uploader(file);
      if (token !== uploadTokenRef.current) return; // superseded
      props.onChange(next);
    } catch (err) {
      if (token !== uploadTokenRef.current) return; // superseded
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const hasValue = props.value !== undefined;

  return (
    <div data-testid="document-picker">
      {uploadError !== null ? (
        <p
          data-testid="document-picker-error"
          role="alert"
          data-error-message={uploadError}
        >
          Upload failed: {uploadError}. Please try again.
        </p>
      ) : null}

      {hasValue ? (
        <div data-testid="document-picker-tile">
          {/* Inline generic-document SVG. Kept inline rather than imported
           * from an icon library to keep the editor-app dep surface
           * narrow — the icon is decorative; the type label below
           * carries the same information textually. */}
          <svg
            data-testid="document-picker-icon"
            aria-hidden="true"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span data-testid="document-picker-filename">{filenameFor(props.value!.path)}</span>
          <span data-testid="document-picker-type">{typeLabelFor(props.value!.mime)}</span>
          <span data-testid="document-picker-size">{formatByteSize(props.value!.byteSize)}</span>
          <button
            type="button"
            data-testid="document-picker-replace"
            onClick={triggerFilePicker}
          >
            Replace document
          </button>
        </div>
      ) : (
        <button
          type="button"
          data-testid="document-picker-add"
          onClick={triggerFilePicker}
        >
          Add document
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        data-testid="document-picker-file-input"
        style={{ display: "none" }}
        onChange={(event) => {
          void onFileChosen(event);
        }}
      />
    </div>
  );
}
