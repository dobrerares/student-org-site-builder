/**
 * Tiny in-package helpers to read/write a value at a nested object path.
 *
 * The form generator emits each leaf field with a `path: string[]`
 * pointing into the snapshot. The form renderer uses these helpers to
 * read the current value and to write a new one without depending on
 * lodash or similar.
 *
 * Both helpers tolerate missing intermediate keys: `getAtPath` returns
 * `undefined` for a path that doesn't exist, `setAtPath` creates plain
 * objects on the way down. Numeric segments (array indices) are
 * supported.
 */

export function getAtPath(root: unknown, path: readonly (string | number)[]): unknown {
  let cursor: unknown = root;
  for (const segment of path) {
    if (cursor === undefined || cursor === null) return undefined;
    cursor = (cursor as Record<string | number, unknown>)[segment];
  }
  return cursor;
}

export function setAtPath(
  root: Record<string, unknown>,
  path: readonly (string | number)[],
  value: unknown,
): void {
  if (path.length === 0) return;
  let cursor: Record<string | number, unknown> = root;
  for (let i = 0; i < path.length - 1; i += 1) {
    const segment = path[i]!;
    const next = cursor[segment];
    if (typeof next !== "object" || next === null) {
      // Build an object container at this level. Numeric segments become
      // string keys — fine for our use because the editor only mutates
      // object-shaped paths; arrays edits go through `update(draft => ...)`.
      cursor[segment] = {};
    }
    cursor = cursor[segment] as Record<string | number, unknown>;
  }
  const last = path[path.length - 1]!;
  cursor[last] = value;
}
