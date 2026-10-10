import { relative } from "node:path";
import { defaultInclude, type Plugin } from "vitest/config";
import { indexDocs, readDocs, resolveDocsOptions, writeFiles, type DocsOptions } from "@ddtds/core";
import { moduleFiles } from "./codegen.ts";
import { createLogger, parseLogLevel, type LogLevel } from "@ddtds/core/log";

export type { CodeBlock, DocIndex, DocsOptions, Fence } from "@ddtds/core";
export {
  DdtCompileError,
  wrapDdtTest,
  defaultDocsInclude,
  defaultDocsExclude,
  defaultOutputDir,
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
      const { root, include, exclude, outputDir } = resolveDocsOptions({
        ...docs,
        root: config.root ?? process.cwd(),
      });
      const index = indexDocs(readDocs(root, include, exclude), { root, outputDir, logger });
      for (const { id, block } of index.fences.values()) {
        logger.debug(`${block.details.file}:${block.line} -> ${relative(root, id)}`);
      }
      writeFiles(outputDir, moduleFiles(index, root));
      logger.info(`Total: ${index.fences.size} tests`);

      const doctests = `${outputDir}/**/*.test.ts`;
      return {
        test: { include: config.test?.include ? [doctests] : [...defaultInclude, doctests] },
      };
    },
  };
}
