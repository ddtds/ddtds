import { type Plugin } from "vitest/config";
import { generate as generateCore, type GenerateDeps } from "@ddtds/core";
import { generateBlockFile } from "./codegen.ts";
import { createLogger, parseLogLevel, type LogLevel } from "@ddtds/core/log";

export type { CodeBlock, GenerateDeps } from "@ddtds/core";
export { wrapDdtTest } from "@ddtds/core";
export type { LogLevel } from "@ddtds/core/log";

export type DdtPluginOptions = {
  /**
   * Precedence (highest to lowest):
   *   1. `DDT_LOG_LEVEL` environment variable
   *   2. `logLevel` option
   *   3. `"info"` (default)
   */
  logLevel?: LogLevel;
};

export function generate(
  searchDir: string,
  outputDir: string,
  deps?: Partial<GenerateDeps>,
): number {
  return generateCore(searchDir, outputDir, generateBlockFile, deps);
}

/**
 * @param searchDir Directory to scan for `.md` and `.mdx` files. Defaults to `"."`
 * @param outputDir Directory to write test files. Defaults to `"__doctests__"`
 */
export function ddtPlugin(
  searchDir: string = ".",
  outputDir: string = "__doctests__",
  options?: DdtPluginOptions,
): Plugin {
  return {
    name: "vite-plugin-ddtds",
    config() {
      const level = parseLogLevel(process.env.DDT_LOG_LEVEL ?? options?.logLevel);
      const logger = createLogger(level);

      generate(searchDir, outputDir, { logger });

      return { test: { include: [`${outputDir}/**/*.test.{ts,tsx}`] } };
    },
  };
}
