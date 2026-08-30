import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: [
        "src/domain/options/**/*.ts",
        "src/domain/government.ts",
        "src/features/government/governmentViewModel.ts",
        "src/shared/contracts/governmentData.ts",
        "scripts/lib/atomicOutput.mjs",
        "scripts/lib/governmentLeaderboard.mjs",
      ],
      thresholds: { statements: 75, branches: 65, functions: 70, lines: 75 },
    },
  },
});
