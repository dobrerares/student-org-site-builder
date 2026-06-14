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
import type { JSX } from "preact";
import type { Site } from "@sosb/schema";

import { buildBlockCatalog, type BlockCatalogEntry } from "./block-catalog.js";

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
}

export function BlockListEditor(props: BlockListEditorProps): JSX.Element {
  const page = props.site.pages.find((p) => p.slug === props.pageSlug);
  const blocks = page?.blocks ?? [];
  const catalog = buildBlockCatalog();

  function entryFor(type: string): BlockCatalogEntry {
    return catalog.entryFor(type);
  }

  return (
    <section data-testid="block-list" data-page-slug={props.pageSlug}>
      <header>
        <h2>Page sections</h2>
        <button type="button" data-testid="block-add" onClick={props.onAddBlock}>
          Add section
        </button>
      </header>

      <ol data-testid="block-list-ol">
        {blocks.map((block, index) => {
          const entry = entryFor(block.type);
          const blockTitle =
            (block.data as { title?: unknown })?.title !== undefined &&
            typeof (block.data as { title?: unknown }).title === "string"
              ? (block.data as { title: string }).title
              : entry.label;
          return (
            <li
              key={block.id}
              data-testid="block-row"
              data-block-id={block.id}
              data-block-index={index}
              onDragOver={(event: JSX.TargetedDragEvent<HTMLLIElement>): void => {
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
                }
              }}
              onDrop={(event: JSX.TargetedDragEvent<HTMLLIElement>): void => {
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
                aria-label={`Drag to reorder ${entry.label}`}
                draggable={true}
                role="button"
                tabIndex={0}
                onDragStart={(event: JSX.TargetedDragEvent<HTMLSpanElement>): void => {
                  if (event.dataTransfer === null) return;
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData(DRAG_MIME, String(index));
                }}
              >
                {/* A simple textual handle keeps the markup framework-free.
                  Actual visual styling lands with the editor's design pass. */}
                <span aria-hidden="true">⋮⋮</span>
              </span>

              {props.onSelect !== undefined ? (
                <button
                  type="button"
                  data-testid="block-row-select"
                  data-action="select"
                  aria-label={`Edit ${entry.label}`}
                  onClick={(): void => props.onSelect?.(block.id)}
                >
                  <span data-testid="block-row-label">{entry.label}</span>
                  <span data-testid="block-row-title">{blockTitle}</span>
                </button>
              ) : (
                <>
                  <span data-testid="block-row-label">{entry.label}</span>
                  <span data-testid="block-row-title">{blockTitle}</span>
                </>
              )}

              <button
                type="button"
                data-testid="block-move-up"
                aria-label={`Move ${entry.label} up`}
                disabled={index === 0}
                onClick={(): void => props.onMove(index, Math.max(0, index - 1))}
              >
                Move up
              </button>
              <button
                type="button"
                data-testid="block-move-down"
                aria-label={`Move ${entry.label} down`}
                disabled={index === blocks.length - 1}
                onClick={(): void => props.onMove(index, Math.min(blocks.length - 1, index + 1))}
              >
                Move down
              </button>
              <button
                type="button"
                data-testid="block-remove"
                aria-label={`Remove ${entry.label}`}
                onClick={(): void => props.onRemove(block.id)}
              >
                Remove
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
