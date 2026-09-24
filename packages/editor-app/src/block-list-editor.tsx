/** @jsxImportSource react */
/**
 * Block list editor — sortable list of a page's blocks.
 *
 * Owned by issue #27. Per the AC:
 *
 * - Drag handle (NOT body drag) initiates reorder. The row itself is not
 *   `draggable`; only the handle inside it is. This matches the PRD's
 *   "drag-and-drop block reordering via explicit drag handle (not body
 *   drag)".
 * - Keyboard alternative is mandatory: each row exposes "Move up" and
 *   "Move down" buttons. The first row's "up" and the last row's "down"
 *   are disabled.
 * - "Remove" button on each row.
 * - "Add Block" button on the list opens the picker.
 *
 * The DnD implementation uses HTML5 native drag-and-drop. We chose this
 * over a third-party library (react-dnd, @dnd-kit, sortablejs) for three
 * reasons:
 * 1. The list is small (a page's blocks, low double-digits) so a heavy
 *    sort engine is overkill.
 * 2. Adding a runtime dep to `@sosb/editor-app` for one feature pulls in
 *    a layout/runtime that does not exist anywhere else in the editor.
 * 3. The keyboard alternative is required regardless, so DnD is purely a
 *    convenience layer.
 *
 * The drop target is the row, not the handle, so a user dragging the
 * handle can drop anywhere on the destination row. The drag payload
 * carries the source index so the drop handler knows what moved.
 */
import type { JSX, ReactNode } from "react";
import { useState } from "react";
import type { BlockEnvelope, CustomBlockRegistry, Site } from "@sosb/schema";
import { customBlockAvailabilityFor, isCustomBlockType } from "@sosb/schema";

import { buildBlockCatalog, type BlockCatalogEntry } from "./block-catalog.js";
import { IconArrowDown, IconArrowUp, IconGrip, IconPlus, IconTrash } from "./icons.js";
import type * as React from "react";
import { Badge, Button } from "@sosb/ui";
import { useTranslator } from "./i18n-context.js";

const DRAG_MIME = "application/x-sosb-block-index";

export interface BlockListEditorProps {
  readonly site: Site;
  readonly pageSlug: string;
  readonly onMove: (from: number, to: number) => void;
  readonly onRemove: (blockId: string) => void;
  readonly onAddBlock: () => void;
  /**
   * Optional drill-in callback. When provided, the row's label/title area
   * becomes a button that fires this callback with the block's id. The
   * surrounding editor uses it to mount a per-block inspector. Omitting it
   * keeps the row labels rendered as plain spans (no drill-in affordance),
   * which is the legacy behaviour for callers that haven't adopted the
   * drill-in pattern yet.
   */
  readonly onSelect?: (blockId: string) => void;
  /**
   * Blocks to edit, overriding the `pageSlug` lookup.
   *
   * Articles hold their Blocks outside `site.pages`, so they cannot be found
   * by slug. Passing them explicitly lets the Articles workspace reuse this
   * editor verbatim rather than growing a parallel one that would drift in
   * drag behaviour, keyboard handling, and catalog labels.
   */
  readonly blocks?: readonly BlockEnvelope[] | undefined;
  /**
   * Replace the default "Page sections" heading. The redesigned workspace
   * labels the outline itself (with its own (i) explanation), and a second
   * heading underneath it would read as a second list.
   */
  readonly heading?: ReactNode;
  /** Optional hint under a custom heading. Omitted when `heading` is set and this is not. */
  readonly hint?: ReactNode;
  /** The Site's Custom Block types (ADR 0055), for labels and the unavailable badge. */
  readonly customBlocks?: CustomBlockRegistry | undefined;
}

export function BlockListEditor(props: BlockListEditorProps): JSX.Element {
  const t = useTranslator();
  const page = props.site.pages.find((p) => p.slug === props.pageSlug);
  const blocks = props.blocks ?? page?.blocks ?? [];
  const catalog = buildBlockCatalog({ customBlocks: props.customBlocks, locale: t.locale });
  // Index of the row currently hovered by a drag, for the drop indicator.
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  function entryFor(type: string): BlockCatalogEntry {
    return catalog.entryFor(type);
  }

  return (
    <section data-testid="block-list" data-page-slug={props.pageSlug}>
      <header>
        <div data-section-heading>
          <h2>{props.heading ?? t("workspace.blocks")}</h2>
          {props.heading === undefined ? (
            <p data-section-hint>
              {page !== undefined
                ? t("blocks.hint.page", { title: page.navLabel })
                : t("blocks.hint")}
            </p>
          ) : props.hint !== undefined ? (
            <p data-section-hint>{props.hint}</p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="primary"
          data-testid="block-add"
          data-variant="primary"
          onClick={props.onAddBlock}
        >
          <IconPlus size={16} />
          <span>{t("blocks.add")}</span>
        </Button>
      </header>

      {blocks.length === 0 ? (
        <div data-testid="block-list-empty" data-empty-state>
          <p>
            <strong>{t("blocks.empty.title")}</strong> {t("blocks.empty.body")}
          </p>
          <Button type="button" variant="primary" data-variant="primary" onClick={props.onAddBlock}>
            <IconPlus size={16} />
            <span>{t("blocks.empty.add")}</span>
          </Button>
        </div>
      ) : null}

      <ol data-testid="block-list-ol" onDragLeave={() => setDropIndex(null)}>
        {blocks.map((block, index) => {
          const entry = entryFor(block.type);
          const rawTitle = (block.data as { title?: unknown })?.title;
          const blockTitle =
            typeof rawTitle === "string" && rawTitle.trim().length > 0 ? rawTitle : entry.label;
          const showLabelAsEyebrow = blockTitle !== entry.label;
          const unavailable =
            isCustomBlockType(block.type) &&
            (props.customBlocks === undefined ||
              customBlockAvailabilityFor(props.customBlocks, block)?.status !== "available");
          return (
            <li
              key={block.id}
              data-testid="block-row"
              data-block-id={block.id}
              data-block-index={index}
              data-unavailable={unavailable ? "true" : undefined}
              data-block-type={block.type}
              data-drop-target={dropIndex === index}
              onDragOver={(event: React.DragEvent<HTMLLIElement>): void => {
                // We allow dropping if the dataTransfer carries our payload.
                // Browsers expose `types` (a `DOMStringList`); some test
                // mocks don't, so we additionally tolerate missing `types`.
                const dt = event.dataTransfer;
                if (dt === null) return;
                const types = (dt as unknown as { types?: ArrayLike<string> | Iterable<string> })
                  .types;
                let carriesOurDrag = false;
                if (types !== undefined) {
                  try {
                    for (const type of types as Iterable<string>) {
                      if (type === DRAG_MIME) {
                        carriesOurDrag = true;
                        break;
                      }
                    }
                  } catch {
                    carriesOurDrag = false;
                  }
                }
                if (!carriesOurDrag) {
                  // Fall back to a getData probe for test mocks.
                  try {
                    if (dt.getData(DRAG_MIME) !== "") carriesOurDrag = true;
                  } catch {
                    /* ignore */
                  }
                }
                if (carriesOurDrag) {
                  event.preventDefault();
                  if (dropIndex !== index) setDropIndex(index);
                }
              }}
              onDrop={(event: React.DragEvent<HTMLLIElement>): void => {
                setDropIndex(null);
                if (event.dataTransfer === null) return;
                const raw = event.dataTransfer.getData(DRAG_MIME);
                if (raw === "" || raw === undefined) return;
                event.preventDefault();
                const from = Number.parseInt(raw, 10);
                if (Number.isNaN(from) || from === index) return;
                props.onMove(from, index);
              }}
            >
              <span
                data-testid="block-drag-handle"
                aria-label={t("blocks.row.drag", { label: entry.label })}
                title={t("blocks.row.drag.title")}
                draggable={true}
                role="button"
                tabIndex={0}
                onDragStart={(event: React.DragEvent<HTMLSpanElement>): void => {
                  if (event.dataTransfer === null) return;
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData(DRAG_MIME, String(index));
                }}
                onDragEnd={() => setDropIndex(null)}
              >
                <IconGrip size={16} />
              </span>

              <span data-block-position aria-hidden="true">
                {index + 1}
              </span>

              {props.onSelect !== undefined ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto min-h-9 flex-col items-start justify-center gap-0 px-1.5 py-1 text-left whitespace-normal"
                  data-testid="block-row-select"
                  data-action="select"
                  aria-label={t("blocks.row.edit", { label: entry.label })}
                  title={t("blocks.row.edit.title")}
                  onClick={(): void => props.onSelect?.(block.id)}
                >
                  <span data-testid="block-row-label" data-eyebrow={showLabelAsEyebrow}>
                    {entry.label}
                  </span>
                  <span data-testid="block-row-title">
                    {blockTitle}
                    {unavailable ? (
                      <Badge tone="error" data-testid="block-row-unavailable">
                        {t("blocks.row.unavailable")}
                      </Badge>
                    ) : null}
                  </span>
                </Button>
              ) : (
                <span data-block-row-text>
                  <span data-testid="block-row-label" data-eyebrow={showLabelAsEyebrow}>
                    {entry.label}
                  </span>
                  <span data-testid="block-row-title">
                    {blockTitle}
                    {unavailable ? (
                      <Badge tone="error" data-testid="block-row-unavailable">
                        {t("blocks.row.unavailable")}
                      </Badge>
                    ) : null}
                  </span>
                </span>
              )}

              <span
                data-row-actions
                role="group"
                aria-label={t("blocks.row.actions", { label: entry.label })}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  data-testid="block-move-up"
                  data-icon-button
                  aria-label={t("blocks.row.moveUp", { label: entry.label })}
                  title={t("blocks.row.moveUp.title")}
                  disabled={index === 0}
                  onClick={(): void => props.onMove(index, Math.max(0, index - 1))}
                >
                  <IconArrowUp size={16} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  data-testid="block-move-down"
                  data-icon-button
                  aria-label={t("blocks.row.moveDown", { label: entry.label })}
                  title={t("blocks.row.moveDown.title")}
                  disabled={index === blocks.length - 1}
                  onClick={(): void => props.onMove(index, Math.min(blocks.length - 1, index + 1))}
                >
                  <IconArrowDown size={16} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  data-testid="block-remove"
                  data-icon-button
                  data-tone="danger"
                  aria-label={t("blocks.row.remove", { label: entry.label })}
                  title={t("blocks.row.remove.title")}
                  onClick={(): void => props.onRemove(block.id)}
                >
                  <IconTrash size={16} />
                </Button>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
