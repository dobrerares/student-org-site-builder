# @sosb/schema

Block + site schemas, severity-tiered validation, migration framework, and
preserve-unknown-keys for forward compatibility.

This package is the single source of truth for the shape of `data.json` —
the canonical artifact every site builds out of. Types are derived from the
runtime schemas via `z.infer`; there is no hand-maintained type duplication.

## Surface

```ts
import {
  // Schemas
  SiteSchema,
  PageSchema,
  HeroBlockSchema,
  BlockEnvelopeSchema,

  // Constants
  SITE_SCHEMA_VERSION,
  HERO_BLOCK_VERSION,

  // Validation
  validate,
  validateBlock,

  // Migration
  migrateSite,
  migrateBlock,

  // Convenience
  parseSite,
  isKnownBlockType,
} from "@sosb/schema";

import type { Site, Page, HeroBlock, ValidationIssue, ValidationResult } from "@sosb/schema";
```

`validate(data)` returns:

```ts
interface ValidationResult {
  errors: ValidationIssue[]; // blocking-on-confirmation
  warnings: ValidationIssue[]; // quality nudge, never blocks
  info: ValidationIssue[]; // silent, Site Health panel only
  ok: boolean; // shorthand: errors.length === 0
}

interface ValidationIssue {
  severity: "error" | "warning" | "info";
  path: (string | number)[];
  code: string; // stable machine identifier
  message: string; // English; i18n is owned by the editor
}
```

## Decisions

See `docs/adr/0002-schema-library-and-validation-model.md` for the library
choice (Zod), the severity-tier policy, and the preserve-unknown-keys
contract.

## Out of scope (v1)

- Block schemas beyond `hero` (issues #9–#22).
- Real version-bump migrations (issue #26).
- Editor form generation (issue #7).
- Renderer / build integration (renderer issues).
