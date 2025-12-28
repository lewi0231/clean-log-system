import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom", // Use 'jsdom' for React hooks testing
    server: {
      deps: {
        inline: [
          "react-native",
          "@react-navigation/native",
          "expo-router",
          "@testing-library/react-native",
        ],
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@/shared": path.resolve(__dirname, "../shared"),
    },
  },
});
