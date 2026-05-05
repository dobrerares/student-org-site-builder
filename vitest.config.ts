import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.{ts,tsx}", "packages/*/src/**/*.test.{ts,tsx}"],
    passWithNoTests: true,
    environment: "node",
  },
  esbuild: {
    // Editor-app tests use Preact JSX. The renderer's `.tsx` source already
    // has its own JSX directive, so this only applies where no per-file
    // pragma is set.
    jsx: "automatic",
    jsxImportSource: "preact",
  },
});
