import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { defaultExclude, defaultInclude, type Plugin } from "vitest/config";
import {
  defaultOutDir,
  DocIndex,
  docModule,
  fenceModule,
  moduleFiles as generateModuleFiles,
  readDocs,
  resolveDocsOptions,
  resolveLogLevel,
  type GeneratedModule,
  type DocsOptions,
  type IndexOptions,
  type LogLevel,
} from "@ddtds/core";
import { getLogger } from "@logtape/logtape";
import { vitestTestAdapter } from "./adapter.ts";
import { configureLogging, createViteSink } from "./logging.ts";

export type { CodeBlock, DocIndex, DocsOptions, Fence, LogLevel } from "@ddtds/core";
export {
  DdtCompileError,
  defaultDocsInclude,
  defaultDocsExclude,
  defaultOutDir,
} from "@ddtds/core";

/** Generated doc and fence modules for `ddt build`. */
export function moduleFiles(index: DocIndex): Map<string, string> {
  return generateModuleFiles(vitestTestAdapter, index);
}

/**
 * The module the plugin serves for a doc or fence id, or `undefined` when the id is
 * neither. `load` delegates here so benchmarks exercise the same path.
 */
export function loadModule(index: DocIndex, id: string): GeneratedModule | undefined {
  if (index.hasDoc(id)) {
    return docModule(vitestTestAdapter, id, index.fencesOf(id), { source: index.sourceOf(id) });
  }
  const fence = index.fence(id);
  if (!fence) return undefined;
  return fenceModule(vitestTestAdapter, fence, index.sourceOf(fence.doc));
}

const logger = getLogger(["ddtds", "vitest"]);

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
  const vite = createViteSink();
  configureLogging(resolveLogLevel(logLevel), vite);
  const moduleDirName = `__ddtds__-${randomUUID().slice(0, 8)}`;
  const indexOptions = (root: string): IndexOptions => ({
    root,
    moduleDir: join(root, moduleDirName),
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
      index = DocIndex.fromSources(readDocs(root, include, exclude), indexOptions(root));
      for (const { id, block } of index.fences()) {
        logger.debug("{file}:{line} -> {id}", () => ({
          file: block.details.file,
          line: block.line,
          id: relative(root, id),
        }));
      }
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
    configResolved(config) {
      vite.attach(config.logger);
      logger.info("Total: {size} tests", { size: index.size });
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
    load(id) {
      const fence = index.fence(id);
      if (fence) this.addWatchFile(fence.doc);
      return loadModule(index, id);
    },
  };
}
