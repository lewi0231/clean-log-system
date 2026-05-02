import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./vitest.setup.ts",
    // Use 'threads' pool instead of 'forks' to avoid EPERM errors on macOS
    // when cleaning up child processes
    pool: "threads",
    // Exclude integration tests by default - they require local Supabase
    // Run integration tests explicitly with: pnpm test:integration
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/__tests__/integration/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "**/*.test.{ts,tsx}",
        "**/__tests__/**",
        "**/__mocks__/**",
        "**/*.config.{ts,js,mjs}",
        "**/vitest.setup.ts",
        "**/middleware.ts",
        "**/next-env.d.ts",
      ],
      // No global thresholds for now — CI reports coverage without failing; tighten in a follow-up.
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom"],
  },
});
