import { defineConfig } from "vitest/config";
import { ddtPlugin } from "@ddtds/vitest";

export default defineConfig({
  plugins: [ddtPlugin()],
  test: {
    environment: "happy-dom",
    setupFiles: ["@testing-library/jest-dom/vitest"],
  },
});
