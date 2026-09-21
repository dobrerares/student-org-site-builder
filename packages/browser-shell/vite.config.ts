import { defineConfig } from "vite";

export default defineConfig({
  root: "dev",
  esbuild: { jsx: "automatic", jsxImportSource: "react" },
  build: { outDir: "../dist/dev", emptyOutDir: true },
});
