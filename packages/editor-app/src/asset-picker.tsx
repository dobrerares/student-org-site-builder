/**
 * AssetPicker — upload-only image-asset widget (ADR 0043, ADR 0044).
 *
 * Replaces the auto-generated hash/mime/path/metadataPath/width/height
 * fieldset that the form-generator would otherwise emit for an
 * `AssetRefLike` slot. Per ADR 0044, none of those fields are
 * human-editable: every value comes from the upload pipeline
 * (`@sosb/assets`'s `uploadAsset`), and the editor MUST NOT render a
 * text/number input that pretends otherwise.
 *
 * Per ADR 0044 Corollary 1 (round-trip is zero re-upload): when a value
 * is supplied to this picker (post-import), the path resolves and the
 * thumbnail renders WITHOUT triggering an upload.
 *
 * Three rendered states:
 *
 *  1. `value` set, image bytes resolve → an `<img>` thumbnail.
 *  2. `value` set, image bytes fail to load (stale reference into a
 *     VFS that no longer has those bytes) → a "missing asset" badge
 *     with a "Re-upload" button. ADR 0044 Corollary 2: never expose
 *     the underlying fields as a fallback editor.
 *  3. `value` undefined → an "Add image" CTA.
 *
 * The only `<input>` this component renders is `<input type="file">`
 * (hidden, triggered programmatically) — the standard upload
 * affordance, which ADR 0044 explicitly carves out from the
 * no-technical-fields rule.
 *
 * Library reuse is intentionally NOT supported (CONTEXT.md: upload-only).
 * Each invocation kicks off a fresh upload through the injected
 * `uploader` prop. The prop indirection lets callers (BlockForm via
 * T11) wire the production `uploadAsset` while tests inject a mock.
 */
import type { JSX } from "preact";
import { useRef, useState } from "preact/hooks";
import type { AssetRefLike } from "@sosb/schema";

export interface AssetPickerProps {
  readonly value: AssetRefLike | undefined;
  readonly onChange: (next: AssetRefLike) => void;
  /** Required: how this picker writes to the VFS. Injected so tests can mock. */
  readonly uploader: (file: File) => Promise<AssetRefLike>;
}

export function AssetPicker(props: AssetPickerProps): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Tracks whether the current `value`'s image bytes failed to load.
  // Keyed on the `hash` of the value so swapping in a fresh AssetRef
  // (after a re-upload) resets the error state automatically.
  const [errorHash, setErrorHash] = useState<string | null>(null);
  // Surface uploader failures (network down, server error, corrupted
  // bytes) above the state-specific UI — per ADR 0044's "never lose
  // user intent silently" spirit, a rejected upload MUST show feedback.
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
      setErrorHash(null);
      props.onChange(next);
    } catch (err) {
      if (token !== uploadTokenRef.current) return; // superseded
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const hasValue = props.value !== undefined;
  const imageErrored = hasValue && errorHash === props.value!.hash;

  return (
    <div data-testid="asset-picker">
      {uploadError !== null ? (
        <p
          data-testid="asset-picker-error"
          role="alert"
          data-error-message={uploadError}
        >
          Upload failed: {uploadError}. Please try again.
        </p>
      ) : null}

      {hasValue && !imageErrored ? (
        <img
          data-testid="asset-picker-thumbnail"
          src={props.value!.path}
          alt={props.value!.alt}
          onError={() => setErrorHash(props.value!.hash)}
        />
      ) : null}

      {hasValue && imageErrored ? (
        <div data-testid="asset-picker-missing" role="status">
          <span>Missing image — the asset bytes could not be loaded.</span>
          <button
            type="button"
            data-testid="asset-picker-reupload"
            onClick={triggerFilePicker}
          >
            Re-upload
          </button>
        </div>
      ) : null}

      {!hasValue ? (
        <button
          type="button"
          data-testid="asset-picker-add"
          onClick={triggerFilePicker}
        >
          Add image
        </button>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        data-testid="asset-picker-file-input"
        style={{ display: "none" }}
        onChange={(event) => {
          void onFileChosen(event);
        }}
      />
    </div>
  );
}
