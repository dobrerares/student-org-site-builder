/** @jsxImportSource react */
/**
 * PackageUpdateDialog — the author-controlled update confirmation
 * (ADR 0055; issue-106 plan, "author-controlled extension updates").
 *
 * Shown only when updating a package to a version whose Custom Block fields
 * changed *and* saved content would be removed. Lists that content — which
 * Page or Article, which block, which field, what it says — and offers two
 * outcomes: keep the current version (nothing changes) or update, which
 * adapts every Block and keeps a recoverable copy of the outgoing package
 * and Blocks. An update that removes nothing never asks.
 *
 * The list is in the author's language: the Block and field names come from
 * the outgoing declaration's translations, and a value that is not the
 * author's own text (a switch, a list, a link to a page) is described here
 * rather than by the schema, which has no locale.
 */
import type { JSX } from "react";
import {
  localizedText,
  type CustomBlockValuePreview,
  type RemovedCustomBlockContent,
} from "@sosb/schema";
import { Button } from "@sosb/ui";

import { EditorDialog } from "./editor-dialog.js";
import { useTranslator } from "./i18n-context.js";

export interface PackageUpdateDialogProps {
  readonly open: boolean;
  readonly packageName: string;
  readonly version: string;
  readonly removed: readonly RemovedCustomBlockContent[];
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

function previewText(
  preview: CustomBlockValuePreview,
  t: ReturnType<typeof useTranslator>,
): string {
  switch (preview.kind) {
    case "text":
      return preview.text;
    case "boolean":
      return t(preview.value ? "packages.update.preview.yes" : "packages.update.preview.no");
    case "entries":
      return t("packages.update.preview.entries", { count: preview.count });
    case "richText":
      return t("packages.update.preview.richText");
    case "link":
      return t(
        preview.target === "page"
          ? "packages.update.preview.linkPage"
          : "packages.update.preview.linkArticle",
      );
    case "group":
      return t("packages.update.preview.group");
    case "none":
      return "";
  }
}

export function PackageUpdateDialog(props: PackageUpdateDialogProps): JSX.Element {
  const t = useTranslator();
  const headingId = "package-update-heading";
  return (
    <EditorDialog
      open={props.open}
      onClose={props.onCancel}
      testId="package-update-dialog"
      labelledBy={headingId}
      tone="warning"
    >
      <h2 id={headingId}>
        {t("packages.update.title", { name: props.packageName, version: props.version })}
      </h2>
      <p>{t("packages.update.intro")}</p>
      <ul data-testid="package-update-removed" data-package-update-removed>
        {props.removed.map((entry, index) => (
          <li
            key={`${entry.blockId}-${entry.path.join(".")}-${index}`}
            data-block-id={entry.blockId}
            data-path={entry.path.join(".")}
          >
            {t("packages.update.entry", {
              document: entry.document.title,
              block: localizedText(entry.blockLabel, t.locale),
              label: localizedText(entry.label, t.locale),
              preview: previewText(entry.preview, t),
            })}
          </li>
        ))}
      </ul>
      <p data-group-hint>{t("packages.update.keep")}</p>
      <div data-dialog-actions>
        <Button type="button" data-testid="package-update-cancel" onClick={props.onCancel}>
          {t("packages.update.cancel")}
        </Button>
        <Button
          type="button"
          variant="primary"
          data-testid="package-update-confirm"
          onClick={props.onConfirm}
        >
          {t("packages.update.confirm")}
        </Button>
      </div>
    </EditorDialog>
  );
}
