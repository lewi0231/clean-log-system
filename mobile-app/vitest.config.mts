import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  // Bundle RNTL with Vite so `react-native` imports are rewritten via `resolve.alias`.
  ssr: {
    noExternal: ["@testing-library/react-native"],
  },
  test: {
    globals: true,
    environment: "jsdom", // Use 'jsdom' for React hooks testing
    setupFiles: ["./vitest-require-react-native-web.cjs", "./vitest.setup.ts"],
    env: {
      EXPO_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      EXPO_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key-for-vitest",
    },
    server: {
      deps: {
        inline: ["@testing-library/react-native"],
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@/shared": path.resolve(__dirname, "../shared"),
      // React Native's package entry uses Flow (`import typeof`), which Node cannot parse.
      // Vitest runs in Node; RN Web is plain JS and matches most component APIs used in tests.
      "react-native": "react-native-web",
    },
  },
});
