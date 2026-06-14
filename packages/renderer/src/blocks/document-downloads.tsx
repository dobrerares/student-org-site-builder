/** @jsxImportSource preact */
import type { DocumentDownloadsBlock } from "@sosb/schema";
import type { AssetUrlForPath } from "../asset-url.js";
import { resolveAssetUrl } from "../asset-url.js";

/**
 * documentDownloads block — renders a list of downloadable documents
 * with accessible labels and visible file-type/size indicators.
 *
 * The block carries an `AssetRef`-shaped pointer per file (hash, path,
 * mime, byteSize). The renderer turns those into anchor elements with:
 *
 * - `href` to the asset path (relative; the build pipeline rewrites
 *   for the served origin).
 * - `download` attribute so click triggers a download instead of a
 *   navigation.
 * - `aria-label` containing the visible label, file-type label
 *   (PDF / DOCX / …), and a human-readable size — so screen-reader
 *   users hear the same information sighted users see in the type +
 *   size indicators.
 *
 * Layouts: `list` (default, vertical anchor list) and `cards` (grid
 * of cards). Both produce the same structural HTML; the layout name
 * is exposed as `data-layout` so theme CSS can style the two
 * differently. Unknown layout strings fall back to `list`.
 *
 * Forward-compat: extra fields on file entries are ignored without
 * throwing. The schema preserves them on round-trip persistence; the
 * renderer just doesn't surface them.
 */

interface DocumentFileShape {
  asset?: {
    hash?: unknown;
    path?: unknown;
    metadataPath?: unknown;
    mime?: unknown;
    byteSize?: unknown;
  };
  label?: unknown;
  description?: unknown;
}

interface DocumentDataShape {
  title?: unknown;
  intro?: unknown;
  layout?: unknown;
  files?: unknown;
}

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

function fileTypeLabel(mime: string | undefined): string {
  if (!mime) return "FILE";
  return TYPE_LABELS_BY_MIME[mime] ?? "FILE";
}

/**
 * Format a byte count as a short, human-readable string.
 *
 * Pinned units: B (under 1 KiB), KB (under 1 MiB), MB (≥ 1 MiB). We
 * use decimal prefixes (1 KB = 1024 B is a known fudge in the user-
 * facing string) to match the convention most file managers display.
 * The accessible aria-label uses the same string so visual and aural
 * surfaces stay in sync.
 */
function formatByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

interface RenderableFile {
  href: string;
  label: string;
  description: string | undefined;
  typeLabel: string;
  sizeLabel: string;
  ariaLabel: string;
}

function readFile(
  raw: unknown,
  assetUrlForPath: AssetUrlForPath | undefined,
): RenderableFile | null {
  if (raw === null || typeof raw !== "object") return null;
  const file = raw as DocumentFileShape;
  const asset = file.asset;
  if (asset === null || typeof asset !== "object") return null;
  const path = readString(asset.path);
  const label = readString(file.label);
  if (path === undefined || label === undefined) return null;
  const mime = readString(asset.mime);
  const byteSize = readNumber(asset.byteSize) ?? 0;
  const typeLabel = fileTypeLabel(mime);
  const sizeLabel = formatByteSize(byteSize);
  const ariaLabel = `${label}, ${typeLabel}, ${sizeLabel}`;
  return {
    href: resolveAssetUrl(path, assetUrlForPath),
    label,
    description: readString(file.description),
    typeLabel,
    sizeLabel,
    ariaLabel,
  };
}

function readLayout(raw: unknown): "list" | "cards" {
  return raw === "cards" ? "cards" : "list";
}

export function DocumentDownloads(props: {
  block: DocumentDownloadsBlock;
  assetUrlForPath?: AssetUrlForPath | undefined;
}): preact.JSX.Element | null {
  const { id, data } = props.block;
  const safeData = data as DocumentDataShape;

  const rawFiles = Array.isArray(safeData.files) ? safeData.files : [];
  const files = rawFiles
    .map((file) => readFile(file, props.assetUrlForPath))
    .filter((file): file is RenderableFile => file !== null);

  // Empty-state suppression: a documentDownloads block with no resolvable
  // files (missing/empty array, or every entry lacks a usable path+label)
  // renders nothing rather than an empty styled container.
  if (files.length === 0) return null;

  const title = readString(safeData.title);
  const intro = readString(safeData.intro);
  const layout = readLayout(safeData.layout);
  const headingId = title !== undefined ? `${id}__title` : undefined;

  const sectionProps: Record<string, string> = {
    "data-block": "documentDownloads",
    "data-block-id": id,
    "data-layout": layout,
  };
  if (headingId !== undefined) {
    sectionProps["aria-labelledby"] = headingId;
  }

  return (
    <section {...sectionProps}>
      <div class="document-downloads__inner">
        {title !== undefined && (
          <h2 id={headingId} class="document-downloads__title">
            {title}
          </h2>
        )}
        {intro !== undefined && <p class="document-downloads__intro">{intro}</p>}
        <ul class="document-downloads__list">
          {files.map((file, index) => (
            <li
              key={`${id}-${index}`}
              class={`document-downloads__item document-downloads__item--${layout}`}
            >
              <a
                class="document-downloads__link"
                href={file.href}
                download
                aria-label={file.ariaLabel}
              >
                <span class="document-downloads__label">{file.label}</span>
                <span class="document-downloads__meta">
                  <span class="document-downloads__type">{file.typeLabel}</span>
                  {" · "}
                  <span class="document-downloads__size">{file.sizeLabel}</span>
                </span>
              </a>
              {file.description !== undefined && (
                <p class="document-downloads__description">{file.description}</p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
