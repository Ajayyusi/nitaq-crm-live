import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    // Mirror the "@/*" path alias from tsconfig.json
    alias: { "@": root },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Style guards read source files from the repo root
    root: root,
    // First run downloads the in-memory MongoDB binary — allow plenty of time.
    hookTimeout: 300_000,
    testTimeout: 30_000,
  },
});
