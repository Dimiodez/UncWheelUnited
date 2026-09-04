import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Keep the production bundle portable: GitHub Pages serves it from
  // /UncWheelUnited/, while UncFutbolLeague.com embeds it at /wheel-app/.
  base: "./",
  plugins: [react()],
  server: {
    watch: {
      ignored: ["**/public/assets/**"]
    }
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"]
  }
});
