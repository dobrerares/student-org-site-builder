import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.{ts,tsx}", "packages/*/src/**/*.test.{ts,tsx}"],
    passWithNoTests: true,
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
  },
  esbuild: {
    // The repo is deliberately mixed: the builder UI (`@sosb/ui`,
    // `@sosb/editor-app`, `@sosb/wizard`, `@sosb/browser-shell`) is React,
    // the public-site renderer stays Preact (ADR 0049). Every `.tsx` file
    // in the repo carries an explicit `@jsxImportSource` pragma, so this
    // default only matters for files that somehow lack one — keep it on
    // the Preact renderer's side, which is the framework-independent half.
    jsx: "automatic",
    jsxImportSource: "preact",
  },
});
