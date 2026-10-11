import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { defaultExclude, defaultInclude, type Plugin } from "vitest/config";
import {
  defaultOutDir,
  DocIndex,
  readDocs,
  resolveDocsOptions,
  sourceFile,
  type DocsOptions,
  type IndexOptions,
} from "@ddtds/core";
import { docModule, fenceModule, inSourceTests } from "./codegen.ts";
import { createLogger, parseLogLevel, type LogLevel } from "@ddtds/core/log";

export type { CodeBlock, DocIndex, DocsOptions, Fence } from "@ddtds/core";
export {
  DdtCompileError,
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
  /** Globs of source files whose JSDoc comments hold code fences to run as tests */
  jsdoc?: string[];
};

export function ddtPlugin({ logLevel, jsdoc = [], ...docs }: DdtPluginOptions = {}): Plugin {
  const logger = createLogger(parseLogLevel(process.env.DDT_LOG_LEVEL ?? logLevel));
  const moduleDirName = `__ddtds__-${randomUUID().slice(0, 8)}`;
  const indexOptions = (root: string): IndexOptions => ({
    root,
    moduleDir: join(root, moduleDirName),
    logger,
  });
  let index = DocIndex.fromSources(new Map(), indexOptions(process.cwd()));

  return {
    name: "vite-plugin-ddtds",
    enforce: "pre",
    config(config) {
      const { root, include, exclude } = resolveDocsOptions({
        ...docs,
        root: config.test?.root ?? config.root ?? process.cwd(),
      });
      const sources = new Map([
        ...readDocs(root, include, exclude),
        ...readDocs(root, jsdoc, exclude),
      ]);
      index = DocIndex.fromSources(sources, indexOptions(root));
      for (const { id, block } of index.fences()) {
        logger.debug(`${block.details.file}:${block.line} -> ${relative(root, id)}`);
      }
      logger.info(`Total: ${index.size} tests`);

      const docFiles = index
        .docs()
        .map(([doc]) => doc)
        .toArray();
      const buildOutput = join(root, defaultOutDir, "**");
      return {
        test: {
          include: [...(config.test?.include ? [] : defaultInclude), ...docFiles],
          exclude: [...(config.test?.exclude ? [] : defaultExclude), buildOutput],
        },
      };
    },
    watchChange(id) {
      if (index.hasDoc(id)) index = index.withDoc(id, readFileSync(id, "utf8"));
    },
    resolveId(source, importer, resolveOptions) {
      if (index.fence(source)) return source;
      if (!importer || !index.hasDoc(importer)) return undefined;
      const fromRoot = join(index.root, "package.json");
      return this.resolve(source, fromRoot, { ...resolveOptions, skipSelf: true });
    },
    transform(code, id) {
      if (!sourceFile.test(id) || !index.hasDoc(id)) return undefined;
      const fences = index.fencesOf(id);
      if (fences.length === 0) return undefined;
      return `${code}\n${inSourceTests(fences)}`;
    },
    load(id) {
      if (index.hasDoc(id) && !sourceFile.test(id)) return docModule(index.fencesOf(id));
      const fence = index.fence(id);
      if (!fence) return undefined;
      this.addWatchFile(fence.doc);
      return fenceModule(fence);
    },
  };
}
