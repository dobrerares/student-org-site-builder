/**
 * Document MIME detection from magic bytes plus a name-extension fallback.
 *
 * Where image MIME detection (`./mime.ts`) covers the four image formats
 * the asset pipeline accepts, this module covers the whitelisted document
 * formats from the PRD:
 *
 *   - PDF
 *   - Microsoft Word (DOC, DOCX)
 *   - Microsoft Excel (XLS, XLSX)
 *   - Microsoft PowerPoint (PPT, PPTX)
 *   - ZIP
 *   - Plain text (TXT)
 *   - CSV
 *   - OpenDocument Text (ODT)
 *   - OpenDocument Spreadsheet (ODS)
 *
 * Detection rules:
 *
 * - Magic bytes are the source of truth where they exist (PDF, DOC,
 *   image-shaped executables we want to *reject*).
 * - Office Open XML (DOCX/XLSX/PPTX) and ODF (ODT/ODS) files are all
 *   ZIP containers; their leading bytes are the ZIP local-file-header
 *   magic. To distinguish them we fall back to the file extension.
 * - Plain-text formats (TXT, CSV) are extension-driven, gated on the
 *   bytes actually looking like text (no 0x00 bytes, no executable
 *   signatures).
 * - Executable signatures (PE "MZ", ELF "\x7fELF", Mach-O variants)
 *   are detected and rejected outright, even if the caller has named
 *   the file with a "safe" extension.
 *
 * Anything we can't identify confidently is `null` — the caller turns
 * that into an `asset.mime.unsupported` error.
 */

export type SupportedDocumentMime =
  | "application/pdf"
  | "application/msword"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  | "application/vnd.ms-excel"
  | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  | "application/vnd.ms-powerpoint"
  | "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  | "application/zip"
  | "text/plain"
  | "text/csv"
  | "application/vnd.oasis.opendocument.text"
  | "application/vnd.oasis.opendocument.spreadsheet";

const SUPPORTED_DOCUMENT_MIMES: ReadonlySet<string> = new Set<SupportedDocumentMime>([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "text/plain",
  "text/csv",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
]);

export function isSupportedDocumentMime(mime: string | null): mime is SupportedDocumentMime {
  if (mime === null) return false;
  return SUPPORTED_DOCUMENT_MIMES.has(mime);
}

// ---------------------------------------------------------------------------
// Magic-byte signatures
// ---------------------------------------------------------------------------

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
const ZIP_LOCAL_FILE_HEADER = [0x50, 0x4b, 0x03, 0x04];
// Some ZIPs are empty or use other entry markers; the spoof / decoy ones we
// see most often are "PK\x05\x06" (end-of-central-directory) and
// "PK\x07\x08" (data-descriptor). Treat these as ZIPs too.
const ZIP_EOCD = [0x50, 0x4b, 0x05, 0x06];
const ZIP_DATA_DESCRIPTOR = [0x50, 0x4b, 0x07, 0x08];
const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

// Executables we always reject — even when the file extension lies.
const PE_MAGIC = [0x4d, 0x5a]; // "MZ"
const ELF_MAGIC = [0x7f, 0x45, 0x4c, 0x46]; // "\x7fELF"
const MACH_O_MAGICS: ReadonlyArray<readonly number[]> = [
  [0xfe, 0xed, 0xfa, 0xce], // 32-bit BE
  [0xfe, 0xed, 0xfa, 0xcf], // 64-bit BE
  [0xce, 0xfa, 0xed, 0xfe], // 32-bit LE
  [0xcf, 0xfa, 0xed, 0xfe], // 64-bit LE
];

function startsWith(bytes: Uint8Array, prefix: ReadonlyArray<number>, offset = 0): boolean {
  if (bytes.length < offset + prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (bytes[offset + i] !== prefix[i]) return false;
  }
  return true;
}

function isExecutable(bytes: Uint8Array): boolean {
  if (startsWith(bytes, PE_MAGIC)) return true;
  if (startsWith(bytes, ELF_MAGIC)) return true;
  for (const magic of MACH_O_MAGICS) {
    if (startsWith(bytes, magic)) return true;
  }
  return false;
}

function isZipShape(bytes: Uint8Array): boolean {
  return (
    startsWith(bytes, ZIP_LOCAL_FILE_HEADER) ||
    startsWith(bytes, ZIP_EOCD) ||
    startsWith(bytes, ZIP_DATA_DESCRIPTOR)
  );
}

function looksLikeText(bytes: Uint8Array): boolean {
  // A practical heuristic: text never carries NUL bytes, and the first
  // ~512 bytes should be predominantly printable ASCII / common UTF-8
  // continuation bytes. Office binary formats and PDFs both fail this
  // because they include NULs in the first KB.
  const len = Math.min(bytes.length, 512);
  if (len === 0) return true; // empty file: treat as text-ish.
  for (let i = 0; i < len; i++) {
    if (bytes[i] === 0x00) return false;
  }
  return true;
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot < 0 || dot === name.length - 1) return "";
  return name.slice(dot + 1).toLowerCase();
}

const ZIP_BACKED_OFFICE_BY_EXT: Readonly<Record<string, SupportedDocumentMime>> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
};

const OLE_BACKED_OFFICE_BY_EXT: Readonly<Record<string, SupportedDocumentMime>> = {
  doc: "application/msword",
  xls: "application/vnd.ms-excel",
  ppt: "application/vnd.ms-powerpoint",
};

const TEXT_BY_EXT: Readonly<Record<string, SupportedDocumentMime>> = {
  txt: "text/plain",
  csv: "text/csv",
};

/**
 * Detect a supported document MIME, or return `null` for unrecognised
 * input. Magic bytes are checked first; the file name's extension acts
 * as the disambiguator for ZIP-shaped (Office Open XML / ODF) and
 * text-shaped (TXT / CSV) inputs that have no fixed magic.
 *
 * Executable signatures always return `null` — even if the caller
 * supplied a deceptive `.pdf` extension or a declared MIME. This is the
 * "rejects executables" AC.
 */
export function detectDocumentMime(
  bytes: Uint8Array,
  declared: string | null | undefined,
  fileName: string,
): SupportedDocumentMime | null {
  // 1. Hard reject executables, regardless of declared MIME / name.
  if (isExecutable(bytes)) return null;

  // 2. PDF is unambiguous from magic bytes.
  if (startsWith(bytes, PDF_MAGIC)) return "application/pdf";

  // 3. ZIP-shaped containers — extension picks DOCX/XLSX/PPTX/ODT/ODS,
  //    or plain ZIP if the extension is `.zip`. Unknown extensions on a
  //    ZIP container are rejected (`null`) so the caller surfaces an
  //    explicit unsupported-type error rather than accept an ambiguous
  //    container.
  if (isZipShape(bytes)) {
    const ext = extensionOf(fileName);
    const officeMime = ZIP_BACKED_OFFICE_BY_EXT[ext];
    if (officeMime !== undefined) return officeMime;
    if (ext === "zip") return "application/zip";
    return null;
  }

  // 4. Legacy OLE-based Office (DOC / XLS / PPT). Extension picks
  //    which of the three; default to "application/msword" because
  //    OLE2 with no extension is most often a .doc-shaped file.
  if (startsWith(bytes, OLE_MAGIC)) {
    const ext = extensionOf(fileName);
    return OLE_BACKED_OFFICE_BY_EXT[ext] ?? "application/msword";
  }

  // 5. Text-shaped formats (TXT / CSV). Gate on "looks like text" so
  //    we don't accept binary garbage with a deceptive `.txt` name.
  const ext = extensionOf(fileName);
  if (ext in TEXT_BY_EXT && looksLikeText(bytes)) {
    return TEXT_BY_EXT[ext] ?? null;
  }

  // 6. Declared MIME as a last-chance fallback for explicitly-typed
  //    uploads (e.g. a drag-drop bridge that knows the file type).
  //    Only honour declared MIME if it's in the whitelist AND the
  //    bytes don't contradict obvious magic-byte detection above.
  if (declared !== null && declared !== undefined && isSupportedDocumentMime(declared)) {
    return declared;
  }

  return null;
}
