/**
 * The registry of Custom Block types a Site can use (ADR 0055).
 *
 * Derived from the Site's installed packages, never from a builder-wide
 * library (ADR 0051: storage is per Site, so the editable archive is
 * self-contained). The editor builds one from the bundles it loaded plus the
 * packages it *failed* to load, and hands it to `validate()`, the Add Block
 * dialog, the Block Inspector and the export readiness panel, so the four
 * cannot disagree about which types exist.
 *
 * A Custom Block type is *available* when exactly one installed package
 * declares it and that package loaded. Otherwise it is *unavailable*, for one
 * of three reasons the issue-106 plan distinguishes:
 *
 *  - `package-missing` — no installed package declares it: an incomplete or
 *    damaged archive, or a package the author removed.
 *  - `needs-newer-builder` — a package declares it but needs a newer builder
 *    than this one.
 *  - `package-damaged` — a package declares it but would not load for some
 *    other reason (a bad manifest, an unsupported field kind).
 *
 * All three preserve content and block export; none of them uses the
 * acknowledgement flow for missing Theme designs (ADR 0045), which applies to
 * an *available* type the active Theme happens not to design.
 */

import type { BlockEnvelope } from "../blocks/index.js";
import { isCustomBlockType, type CustomBlockDeclaration } from "./declaration.js";

/** A package that loaded, with the Custom Block types it declares. */
export interface CustomBlockPackageSource {
  readonly packageId: string;
  readonly packageVersion: string;
  readonly declarations: readonly CustomBlockDeclaration[];
}

/**
 * A package that did *not* load, with whatever could be read leniently: the
 * Custom Block types its manifest points at, so a Block of one of those types
 * can say "this package needs a newer builder" rather than "missing".
 */
export interface CustomBlockFailedPackageSource {
  readonly packageId: string;
  /** The package loader's stable error code (`format-version-unsupported`, …). */
  readonly errorCode: string;
  /** Developer-facing detail from the loader. */
  readonly message: string;
  readonly declaredTypes: readonly string[];
}

export type CustomBlockUnavailableReason =
  | "package-missing"
  | "needs-newer-builder"
  | "package-damaged"
  /** The saved Block data is newer than the installed declaration understands. */
  | "data-newer";

export interface CustomBlockAvailable {
  readonly status: "available";
  readonly declaration: CustomBlockDeclaration;
  readonly packageId: string;
  readonly packageVersion: string;
}

export interface CustomBlockUnavailable {
  readonly status: "unavailable";
  readonly reason: CustomBlockUnavailableReason;
  readonly packageId: string | undefined;
  /** Operator-readable summary; the editor localises its own copy by `reason`. */
  readonly message: string;
}

export type CustomBlockAvailability = CustomBlockAvailable | CustomBlockUnavailable;

export interface CustomBlockRegistry {
  /** Every available type, sorted by type id. */
  readonly available: readonly CustomBlockAvailable[];
  /** What the registry knows about a type. Built-in and unknown types answer `undefined`. */
  lookup(type: string): CustomBlockAvailability | undefined;
}

/** Codes the package loader raises when a package is from the future. */
const NEWER_BUILDER_CODES: ReadonlySet<string> = new Set([
  "format-version-unsupported",
  "block-format-unsupported",
]);

/**
 * Build the registry from the installed packages.
 *
 * When two loaded packages declare the same type, the one with the smaller
 * package id wins and the other is ignored — deterministically, so the same
 * archive resolves the same way on every machine. Two packages shipping the
 * same namespaced type is a packaging mistake, not a state the builder can
 * make sense of, and it is reported in the loader's own checks rather than
 * guessed at here.
 */
export function buildCustomBlockRegistry(
  loaded: readonly CustomBlockPackageSource[],
  failed: readonly CustomBlockFailedPackageSource[] = [],
): CustomBlockRegistry {
  const table = new Map<string, CustomBlockAvailability>();
  const sortedLoaded = [...loaded].sort((a, b) => a.packageId.localeCompare(b.packageId));
  for (const pkg of sortedLoaded) {
    for (const declaration of pkg.declarations) {
      if (table.has(declaration.type)) continue;
      table.set(declaration.type, {
        status: "available",
        declaration,
        packageId: pkg.packageId,
        packageVersion: pkg.packageVersion,
      });
    }
  }
  const sortedFailed = [...failed].sort((a, b) => a.packageId.localeCompare(b.packageId));
  for (const pkg of sortedFailed) {
    for (const type of pkg.declaredTypes) {
      if (table.has(type)) continue;
      const newer = NEWER_BUILDER_CODES.has(pkg.errorCode);
      table.set(type, {
        status: "unavailable",
        reason: newer ? "needs-newer-builder" : "package-damaged",
        packageId: pkg.packageId,
        message: newer
          ? `The package "${pkg.packageId}" that provides this block needs a newer version of the builder. ` +
            `Your content is kept; update the builder to edit or export it.`
          : `The package "${pkg.packageId}" that provides this block could not be loaded: ${pkg.message} ` +
            `Your content is kept; import a working version of the package to edit or export it.`,
      });
    }
  }
  const available = [...table.values()]
    .filter((entry): entry is CustomBlockAvailable => entry.status === "available")
    .sort((a, b) => a.declaration.type.localeCompare(b.declaration.type));
  return {
    available,
    lookup(type: string): CustomBlockAvailability | undefined {
      const known = table.get(type);
      if (known !== undefined) return known;
      if (!isCustomBlockType(type)) return undefined;
      return {
        status: "unavailable",
        reason: "package-missing",
        packageId: undefined,
        message:
          `The package that provides the "${type}" block is not installed. Your content is kept; ` +
          `import the package to edit or export it.`,
      };
    },
  };
}

/** A registry with no packages: every Custom Block type is missing. */
export const EMPTY_CUSTOM_BLOCK_REGISTRY: CustomBlockRegistry = buildCustomBlockRegistry([]);

/**
 * The availability of one saved Block, which is the registry's answer for its
 * type *plus* the data-version check: a Block saved by a newer version of the
 * package than the one installed carries fields this declaration cannot show,
 * so it is unavailable — kept, not editable, not exportable — until the newer
 * package is imported (issue-106 plan, "cannot read the saved Block data
 * version", resolved in ADR 0055). Data *older* than the declaration stays
 * editable: the update flow adapts it, and until then every field the
 * declaration names simply reads as empty.
 */
export function customBlockAvailabilityFor(
  registry: CustomBlockRegistry,
  block: Pick<BlockEnvelope, "type" | "version">,
): CustomBlockAvailability | undefined {
  const entry = registry.lookup(block.type);
  if (entry === undefined || entry.status === "unavailable") return entry;
  if (block.version > entry.declaration.version) {
    return {
      status: "unavailable",
      reason: "data-newer",
      packageId: entry.packageId,
      message:
        `This block was saved by a newer version of the package "${entry.packageId}" ` +
        `(data version ${block.version}; installed version understands ${entry.declaration.version}). ` +
        `Your content is kept; import that newer package to edit or export it.`,
    };
  }
  return entry;
}
