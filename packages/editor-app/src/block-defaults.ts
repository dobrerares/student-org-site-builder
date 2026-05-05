/**
 * Default-data factory for blocks added via the "Add Block" dialog.
 *
 * For every type in `@sosb/schema`'s `KnownBlockSchemas` registry the
 * factory returns a block that the schema's parser accepts (so the user
 * lands inside the editor with a valid block, not a half-shaped one). For
 * unknown types — the open-set forward-compat path — the factory emits a
 * generic envelope with an empty data object, matching the policy in
 * ADR 0002.
 *
 * Owned by issue #27.
 */
import { HERO_BLOCK_VERSION, type BlockEnvelope } from "@sosb/schema";

/** Make a short, URL-safe id without depending on `crypto.randomUUID`. */
function makeBlockId(type: string): string {
  // Random part: 8 base36 chars from `Math.random()`. Determinism is not
  // required here (the renderer's determinism contract is over data, not
  // over freshly-created blocks).
  const rand = Math.random().toString(36).slice(2, 10);
  // Time component to avoid same-tick collisions inside a synchronous loop.
  const tick = Date.now().toString(36);
  return `blk_${type}_${tick}${rand}`;
}

interface DefaultBuilder {
  readonly version: number;
  readonly data: () => Record<string, unknown>;
}

/**
 * Per-type defaults table. Keys MUST match `KnownBlockSchemas`. New entries
 * land alongside their schema; the fallback path keeps the editor running
 * if a registry entry has no defaults entry.
 */
const DEFAULT_BUILDERS: Record<string, DefaultBuilder> = {
  hero: {
    version: HERO_BLOCK_VERSION,
    data: () => ({ title: "New page" }),
  },
};

/**
 * Build a default block envelope for the given registry key.
 *
 * Unknown types fall through to a generic `{ version: 1, data: {} }`
 * envelope so the editor stays operable when schemas land ahead of editor
 * defaults.
 */
export function defaultBlockFor(type: string): BlockEnvelope {
  const builder = DEFAULT_BUILDERS[type];
  if (builder !== undefined) {
    return {
      id: makeBlockId(type),
      type,
      version: builder.version,
      data: builder.data(),
    };
  }
  return {
    id: makeBlockId(type),
    type,
    version: 1,
    data: {},
  };
}
