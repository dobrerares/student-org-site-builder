#!/usr/bin/env node
/**
 * `pnpm build:archival` — produce the single-file archival HTML.
 *
 * Loads the TypeScript runner via an in-process esbuild bundle (the same
 * trick the build-browser e2e uses) so we don't add a runtime tsx
 * dependency. The bundle is written next to the source so node's module
 * resolution finds the workspace's `node_modules`.
 */
import { build as esbuild } from "esbuild";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const runnerEntry = join(__dirname, "run-archival-build.ts");

const stagingDir = join(__dirname, ".staging");
mkdirSync(stagingDir, { recursive: true });
const outFile = join(stagingDir, `runner-${process.pid}-${Date.now()}.mjs`);

try {
  const result = await esbuild({
    entryPoints: [runnerEntry],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    target: "es2022",
    jsx: "automatic",
    jsxImportSource: "preact",
    external: ["esbuild"],
  });
  const out = result.outputFiles[0];
  if (out === undefined) throw new Error("build-archival.mjs: esbuild produced no output");
  writeFileSync(outFile, out.text, "utf8");

  const { runArchivalBuild } = await import(pathToFileURL(outFile).href);
  await runArchivalBuild();
} finally {
  try {
    rmSync(stagingDir, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
}
