/**
 * VFS-backed wizard progress store.
 *
 * Mirrors `@sosb/editor-state`'s autosave model (ADR 0005) and recent-sites'
 * VFS pattern (ADR 0006): a single file at a stable path, caller-injected
 * driver, JSON with a trailing newline. The browser host wires a
 * localStorage-backed VFS; the Electron host wires a real-FS driver. Both
 * round-trip the same JSON.
 *
 * The persistence layer treats the wizard state as opaque-ish JSON: it
 * verifies the saved `step` is one of the six known step ids and the
 * `data` is an object, but it does not deep-validate per-step shapes —
 * users may have saved a state that no longer matches the current
 * wizard's expectations after a code update, and the safe fallback is
 * `null` (start over).
 *
 * Tracking issue: #33. ADR 0007 records the design.
 */

import type { Vfs } from "@sosb/vfs";
import { STEPS, type WizardState, type WizardStep } from "./state-machine.js";

/**
 * Stable VFS path where the wizard's progress is stored. Matching the
 * `editor/autosave.json` and `welcome/recent-sites.json` conventions.
 */
export const WIZARD_PROGRESS_PATH = "wizard/progress.json" as const;

/**
 * 2-space indent matches `@sosb/zip`'s `data.json` and editor-state's
 * autosave format — keeps debugging-by-cat simple.
 */
const WIZARD_PROGRESS_INDENT = 2;

const enc = new TextEncoder();
const dec = new TextDecoder("utf-8", { fatal: false });

/**
 * Read the persisted wizard state. Returns `null` for any of:
 *
 *   - the file does not exist (first-time wizard launch)
 *   - the file is malformed JSON
 *   - the file is JSON but not a valid `WizardState` shape (step missing
 *     or unknown, data not an object)
 *
 * Callers (the host harness in `wizard.tsx`) treat `null` as "start
 * fresh": the wizard mounts on the basics step with empty data.
 */
export async function loadWizardProgress(vfs: Vfs): Promise<WizardState | null> {
  if (!(await vfs.has(WIZARD_PROGRESS_PATH))) return null;

  let parsed: unknown;
  try {
    const bytes = await vfs.read(WIZARD_PROGRESS_PATH);
    parsed = JSON.parse(dec.decode(bytes));
  } catch {
    return null;
  }

  if (parsed === null || typeof parsed !== "object") return null;
  const candidate = parsed as Record<string, unknown>;

  const step = candidate["step"];
  const data = candidate["data"];
  if (typeof step !== "string") return null;
  if (!isKnownStep(step)) return null;
  if (data === null || typeof data !== "object") return null;

  // We accept the data slot as-is — per-step shapes are tolerant of
  // extra fields, and any missing field means "user didn't fill it"
  // which the wizard handles natively.
  return {
    step,
    data: data as WizardState["data"],
  };
}

/**
 * Persist the current wizard state. Writes a single file to
 * `WIZARD_PROGRESS_PATH`; concurrent callers race on last-writer-wins,
 * which is acceptable for a UX flow where the human is the only writer.
 */
export async function saveWizardProgress(vfs: Vfs, state: WizardState): Promise<void> {
  const text = JSON.stringify(state, null, WIZARD_PROGRESS_INDENT) + "\n";
  await vfs.write(WIZARD_PROGRESS_PATH, enc.encode(text));
}

/**
 * Drop the persisted wizard state. Called when the user finishes the
 * wizard ("Create") or cancels — the next launch starts fresh.
 *
 * No-ops gracefully when the file does not exist (first launch, or
 * already cleared). The implementation deliberately does not propagate
 * `VfsNotFoundError` because clearing-when-absent is a normal flow.
 */
export async function clearWizardProgress(vfs: Vfs): Promise<void> {
  if (await vfs.has(WIZARD_PROGRESS_PATH)) {
    await vfs.delete(WIZARD_PROGRESS_PATH);
  }
}

function isKnownStep(value: string): value is WizardStep {
  return (STEPS as readonly string[]).includes(value);
}
