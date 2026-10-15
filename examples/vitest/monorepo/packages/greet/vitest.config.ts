import { defineConfig } from "vitest/config";
import { ddtPlugin } from "@ddtds/vitest";
import packageJson from "./package.json" with { type: "json" };

export default defineConfig({
  plugins: [ddtPlugin({ include: ["../../docs/*.md", "src/*.ts"] })],
  test: { name: packageJson.name, dir: "./tests", typecheck: { enabled: true } },
});
