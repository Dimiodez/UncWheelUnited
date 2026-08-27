import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/UncWheelUnited/",
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
