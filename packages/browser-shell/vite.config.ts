import { defineConfig } from "vite";

export default defineConfig({
  root: "dev",
  esbuild: { jsx: "automatic", jsxImportSource: "preact" },
  build: { outDir: "../dist/dev", emptyOutDir: true },
});
