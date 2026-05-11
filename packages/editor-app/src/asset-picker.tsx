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

  const triggerFilePicker = (): void => {
    fileInputRef.current?.click();
  };

  const onFileChosen = async (
    event: JSX.TargetedEvent<HTMLInputElement>,
  ): Promise<void> => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (file === undefined) return;
    const next = await props.uploader(file);
    // Clear the input so picking the same filename twice still fires
    // onChange — otherwise the second selection is a no-op.
    input.value = "";
    setErrorHash(null);
    props.onChange(next);
  };

  const hasValue = props.value !== undefined;
  const imageErrored = hasValue && errorHash === props.value!.hash;

  return (
    <div data-testid="asset-picker">
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
