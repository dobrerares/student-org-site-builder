import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// THROWAWAY prototype (issue #102). Standalone app; shares no code with packages/.
export default defineConfig({
  plugins: [react()],
  server: { host: "127.0.0.1", port: 5202 },
});
