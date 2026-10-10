import { join, relative } from "node:path";
import { defaultInclude, type Plugin } from "vitest/config";
import {
  defaultOutDir,
  DocIndex,
  readDocs,
  resolveDocsOptions,
  writeFiles,
  type DocsOptions,
} from "@ddtds/core";
import { moduleFiles } from "./codegen.ts";
import { createLogger, parseLogLevel, type LogLevel } from "@ddtds/core/log";

export type { CodeBlock, DocIndex, DocsOptions, Fence } from "@ddtds/core";
export {
  DdtCompileError,
  DdtTestError,
  wrapDdtTest,
  defaultDocsInclude,
  defaultDocsExclude,
  defaultOutDir,
} from "@ddtds/core";
export { moduleFiles } from "./codegen.ts";
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

export function ddtPlugin({ logLevel, ...docs }: DdtPluginOptions = {}): Plugin {
  const logger = createLogger(parseLogLevel(process.env.DDT_LOG_LEVEL ?? logLevel));
  return {
    name: "vite-plugin-ddtds",
    config(config) {
      const { root, include, exclude } = resolveDocsOptions({
        ...docs,
        root: config.test?.root ?? config.root ?? process.cwd(),
      });
      const moduleDir = join(root, defaultOutDir);
      const index = DocIndex.fromSources(readDocs(root, include, exclude), {
        root,
        moduleDir,
        logger,
      });
      for (const { id, block } of index.fences()) {
        logger.debug(`${block.details.file}:${block.line} -> ${relative(root, id)}`);
      }
      writeFiles(moduleDir, moduleFiles(index));
      logger.info(`Total: ${index.size} tests`);

      const doctests = `${moduleDir}/**/*.test.ts`;
      return {
        test: { include: config.test?.include ? [doctests] : [...defaultInclude, doctests] },
      };
    },
  };
}
