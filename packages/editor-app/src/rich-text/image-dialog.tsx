/** @jsxImportSource react */
/**
 * The image dialog: pick a file, describe it, optionally caption it.
 *
 * It reuses `<AssetPicker>` rather than growing a second upload path. That
 * is the whole reason rich-text images are stored as asset references: the
 * pipeline, the archive round trip, the oversized-image warning and the
 * "reopening requires no image re-uploads" guarantee all come along for
 * free, and there is exactly one place in the codebase where an image enters
 * a project.
 *
 * The description is captured *here* rather than as a sibling field the way
 * hero and quote do it. A rich-text image has no sibling to put it in — it
 * lives inside a document node — and asking for it at the moment the author
 * chooses the file is also the moment they know what the picture shows.
 * An empty description is still allowed: it is a warning, never a block, so
 * the dialog nudges rather than refusing to close (issue #100).
 */
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { Button, Input, Label } from "@sosb/ui";
import type { AssetRefLike } from "@sosb/schema";
import { AssetPicker } from "../asset-picker.js";
import { EditorDialog } from "../editor-dialog.js";
import { FieldHint } from "../field-hint.js";
import { useTranslator } from "../i18n-context.js";

export interface RichTextImageDialogProps {
  readonly open: boolean;
  readonly uploader: (file: File, suggestedAlt?: string) => Promise<AssetRefLike>;
  readonly displayUrlFor?: ((ref: AssetRefLike) => string | undefined) | undefined;
  readonly onClose: () => void;
  readonly onInsert: (asset: AssetRefLike, caption: string) => void;
}

export function RichTextImageDialog(props: RichTextImageDialogProps): JSX.Element {
  const t = useTranslator();
  const [asset, setAsset] = useState<AssetRefLike | undefined>(undefined);
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");

  useEffect(() => {
    if (!props.open) return;
    setAsset(undefined);
    setAlt("");
    setCaption("");
  }, [props.open]);

  return (
    <EditorDialog
      open={props.open}
      onClose={props.onClose}
      testId="rich-text-image-dialog"
      label={t("richText.image.title")}
    >
      <h2>{t("richText.image.title")}</h2>
      <p>{t("richText.image.description")}</p>

      <AssetPicker
        value={asset}
        onChange={(next) => {
          setAsset(next);
          // The pipeline rejects an empty alt, so the uploader falls back to
          // the file name. Seeding the field with it gives the author
          // something to edit rather than an empty box, and makes it obvious
          // that a file name is not a description.
          if (alt === "" && typeof next.alt === "string") setAlt(next.alt);
        }}
        uploader={(file) => props.uploader(file, alt === "" ? undefined : alt)}
        displayUrlFor={props.displayUrlFor}
      />

      <Label htmlFor="rich-text-image-alt">{t("richText.image.alt.label")}</Label>
      <Input
        id="rich-text-image-alt"
        data-testid="rich-text-image-alt"
        type="text"
        value={alt}
        onInput={(event) => setAlt((event.target as HTMLInputElement).value)}
      />
      <FieldHint hint={t("richText.image.alt.help")} />

      <Label htmlFor="rich-text-image-caption">{t("richText.image.caption.label")}</Label>
      <Input
        id="rich-text-image-caption"
        data-testid="rich-text-image-caption"
        type="text"
        value={caption}
        onInput={(event) => setCaption((event.target as HTMLInputElement).value)}
      />
      <FieldHint hint={t("richText.image.caption.help")} />

      <Button
        data-testid="rich-text-image-insert"
        disabled={asset === undefined}
        onClick={() => {
          if (asset === undefined) return;
          props.onInsert({ ...asset, alt }, caption.trim());
        }}
      >
        {t("richText.image.action.insert")}
      </Button>
      <Button variant="ghost" data-testid="rich-text-image-cancel" onClick={props.onClose}>
        {t("richText.image.action.cancel")}
      </Button>
    </EditorDialog>
  );
}
