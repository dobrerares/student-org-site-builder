# @sosb/vfs

Virtual filesystem abstraction with multiple drivers.

The shipped drivers in v1 are `MemoryDriver` (used by tests and the
editor's in-memory document model) and `ZipDriver` (used by `@sosb/zip`
to serialise / deserialise the canonical exported zip artefact). Future
IndexedDB / OPFS / Electron-FS drivers (#35, #37) will plug in by
implementing the same `Vfs` interface and re-using the shared
conformance suite.

## Surface

```ts
import {
  // Interface
  type Vfs,

  // Drivers
  MemoryDriver,
  ZipDriver,
  ZIP_DRIVER_MTIME,

  // Errors
  VfsInvalidPathError,
  VfsNotFoundError,
  VfsAlreadyExistsError,

  // Path helpers
  validatePath,
  validatePrefix,
} from "@sosb/vfs";
```

`Vfs`:

```ts
interface Vfs {
  read(path: string): Promise<Uint8Array>;
  write(path: string, bytes: Uint8Array): Promise<void>;
  list(prefix?: string): Promise<string[]>;
  delete(path: string): Promise<void>;
  copy(from: string, to: string): Promise<void>;
  has(path: string): Promise<boolean>;
}
```

Paths are POSIX-style, forward-slash, no leading `/`. Validation is
shared by every driver (see `validatePath`). `read` / `delete` / `copy`
of an absent path throws `VfsNotFoundError`; malformed paths throw
`VfsInvalidPathError`.

## Shared conformance suite

Every driver ships a passing test against the shared suite at
`@sosb/vfs/test-conformance`:

```ts
// packages/vfs-future-driver/test/conformance.test.ts
import { runVfsConformance } from "@sosb/vfs/test-conformance";
import { FutureDriver } from "../src/index.js";

runVfsConformance("FutureDriver", () => new FutureDriver());
```

If your driver passes the suite, call sites can substitute it for any
other driver without behavioural change.

## Decisions

See `docs/adr/0003-vfs-and-zip-import-export.md` for the interface
shape, the path policy, and the deterministic-output contract.

## Out of scope (v1)

- IndexedDB / OPFS / Electron-FS drivers (issues #35, #37).
- Asset processing pipeline (issue #8).
- Editor integration (issue #7).
