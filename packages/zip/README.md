# @sosb/zip

Bidirectional import / export with round-trip preservation.

`exportToZip(siteData, vfs)` produces a `Blob` with the v1 PRD layout —
`data.json` + `assets/` + (placeholder) `dist/` + (placeholder)
`DEPLOY.md`. `importFromZip(blob)` reads the blob back into a
validated `siteData` plus a `MemoryDriver` holding the asset bytes,
running `@sosb/schema`'s `migrateSite` on the way in.

## Surface

```ts
import {
  exportToZip,
  importFromZip,
  ZipImportError,
  type ZipImportErrorCode,
  type ImportResult,
} from "@sosb/zip";
```

```ts
function exportToZip(siteData: unknown, vfs: Vfs): Promise<Blob>;
function importFromZip(blob: Blob): Promise<ImportResult>;

interface ImportResult {
  siteData: Site; // validated and migrated
  vfs: Vfs; // MemoryDriver populated with assets/...
}
```

## Round-trip identity

Given the same `(siteData, vfs)`, `exportToZip` produces a
byte-identical zip across calls. The same `Blob` can be fed back to
`importFromZip → exportToZip` indefinitely without drift. This is the
contract that lets users edit, export, re-import, and re-export
without their data accreting compression or timestamp noise.

## Error handling

`importFromZip` throws `ZipImportError` with a stable `code` on every
malformed-input branch:

| code                         | meaning                                                          |
| ---------------------------- | ---------------------------------------------------------------- |
| `zip.invalid`                | The byte stream is not a valid zip.                              |
| `zip.dataJson.missing`       | The zip is valid but contains no `data.json`.                    |
| `zip.dataJson.invalidJson`   | `data.json` exists but is not parseable JSON.                    |
| `zip.dataJson.invalidShape`  | `data.json` parses but does not match the site schema.           |
| `zip.dataJson.versionTooNew` | The input `schemaVersion` is newer than this editor understands. |

For `invalidShape`, the full `ValidationResult` is attached on
`error.validation` so the editor can surface field-level details.

## Decisions

See `docs/adr/0003-vfs-and-zip-import-export.md` for the zip-library
choice (fflate), the layout, and the schema-migration policy on
import.

## Out of scope (v1)

- Real `dist/` content in the exported zip (issues #5, #46).
- Asset transforms — resizing, hashing, re-encoding (issue #8).
- Filesystem / Electron-backed VFS drivers (issues #35, #37).
- Editor UI integration (issue #7).
