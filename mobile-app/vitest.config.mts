import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: "node", // Use 'node' for utility functions, not 'jsdom'
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@/shared": path.resolve(__dirname, "../shared"),
    },
  },
});
