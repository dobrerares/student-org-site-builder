# @sosb/zip

Bidirectional import / export with round-trip preservation, plus the
user-facing `DEPLOY.md` generator.

`exportToZip(siteData, vfs)` produces a `Blob` with the v1 PRD layout —
`data.json` + `assets/` + built `dist/` + generated `DEPLOY.md`.
`importFromZip(blob)` reads the blob back into a validated `siteData`
plus a `MemoryDriver` holding the asset bytes, running `@sosb/schema`'s
`migrateSite` on the way in.

## Surface

```ts
import {
  exportToZip,
  importFromZip,
  generateDeployMd,
  ZipImportError,
  type ZipImportErrorCode,
  type ImportResult,
  type DeployLanguage,
  type DeployMdInput,
} from "@sosb/zip";
```

```ts
function exportToZip(siteData: unknown, vfs: Vfs): Promise<Blob>;
function importFromZip(blob: Blob): Promise<ImportResult>;
function generateDeployMd(input: DeployMdInput): string;

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

## DEPLOY.md generator

```ts
import { generateDeployMd } from "@sosb/zip";

const md = generateDeployMd({
  language: "ro", // or "en"
  org: { name: "Asociația Studențească HISTORIPOL" },
  siteUrl: "https://historipol.ro", // optional
  customDomain: "historipol.ro", // optional
});
// md is the full DEPLOY.md text, ready to write into the export zip
// or render in the in-app guide modal.
```

`generateDeployMd` is the user-facing handoff generator: every exported
zip ships a `DEPLOY.md` walking the user through Cloudflare Pages
deployment in their editor language (RO / EN), and the in-app "Open
guide" modal renders the same string this function produces.

See [`docs/adr/0027-deploy-md-generator.md`](../../docs/adr/0027-deploy-md-generator.md)
for the design decisions, [`docs/deploy/cloudflare-pages.md`](../../docs/deploy/cloudflare-pages.md)
for the maintainer-facing reference, and the test golden files at
`test/__golden__/` for representative output.

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
import. See `docs/adr/0027-deploy-md-generator.md` for the DEPLOY.md
generator design.

## Out of scope (v1)

- Asset transforms during zip export. Upload-time image/document processing lives in
  `@sosb/assets`; export copies the prepared `assets/` files verbatim.
- Filesystem / Electron-backed VFS drivers outside the VFS interface.
- Hosted publishing automation. The zip contains a static `dist/` folder and guide,
  but users still upload or connect it to Cloudflare Pages themselves.
