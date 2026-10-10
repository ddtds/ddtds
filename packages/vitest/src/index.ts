import { resolve } from "node:path";
import { defaultInclude, type Plugin } from "vitest/config";
import {
  defaultOutputDir,
  generate as generateCore,
  type DocsOptions,
  type GenerateDeps,
  type GenerateOptions,
} from "@ddtds/core";
import { generateBlockFile } from "./codegen.ts";
import { createLogger, parseLogLevel, type LogLevel } from "@ddtds/core/log";

export type { CodeBlock, DocsOptions, GenerateDeps, GenerateOptions } from "@ddtds/core";
export { wrapDdtTest, defaultDocsInclude, defaultDocsExclude, defaultOutputDir } from "@ddtds/core";
export type { LogLevel } from "@ddtds/core/log";

export type DdtPluginOptions = DocsOptions & {
  /**
   * Precedence (highest to lowest):
   *   1. `DDT_LOG_LEVEL` environment variable
   *   2. `logLevel` option
   *   3. `"info"` (default)
   */
  logLevel?: LogLevel;
};

export function generate(options: GenerateOptions, deps?: Partial<GenerateDeps>): number {
  return generateCore(options, generateBlockFile, deps);
}

export function ddtPlugin({ logLevel, ...docs }: DdtPluginOptions = {}): Plugin {
  return {
    name: "vite-plugin-ddtds",
    config(config) {
      const logger = createLogger(parseLogLevel(process.env.DDT_LOG_LEVEL ?? logLevel));
      const root = config.root ?? process.cwd();
      const outputDir = resolve(root, docs.outputDir ?? defaultOutputDir);
      generate({ ...docs, root, outputDir }, { logger });

      const doctests = `${outputDir}/**/*.test.{ts,tsx}`;
      const include = config.test?.include ? [doctests] : [...defaultInclude, doctests];
      return { test: { include } };
    },
  };
}
