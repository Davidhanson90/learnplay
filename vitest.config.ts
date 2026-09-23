import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "coverage",
      include: ["src/maze/**/*.ts", "src/rl/**/*.ts"],
      exclude: ["src/**/*.spec.ts", "src/**/*.test.ts", "src/maze/index.ts", "src/rl/index.ts"],
      thresholds: {
        perFile: true,
        statements: 85,
        branches: 80,
        functions: 85,
        lines: 85
      }
    }
  }
});
