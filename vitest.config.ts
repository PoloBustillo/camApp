import { defineConfig } from "vitest/config"
import tsconfigPaths from "vite-tsconfig-paths"
import { resolve } from "path"

export default defineConfig({
  plugins: [tsconfigPaths()],
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
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
})
