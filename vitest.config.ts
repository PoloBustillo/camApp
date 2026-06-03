import { defineConfig } from "vitest/config"
import tsconfigPaths from "vite-tsconfig-paths"
import { resolve } from "path"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      "next/server": resolve("node_modules/next/server.js"),
      "next/headers": resolve("node_modules/next/headers.js"),
      "next/navigation": resolve("node_modules/next/navigation.js"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["src/__tests__/**/*.test.ts", "src/__tests__/**/*.test.tsx"],
    environmentMatchGlobs: [
      ["src/__tests__/dashboard/**/*.test.tsx", "jsdom"],
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
})

