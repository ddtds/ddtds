import { join, relative } from "node:path";
import { defaultExclude, defaultInclude, type Plugin } from "vitest/config";
import {
  DdtSession,
  DocIndex,
  defaultOutDir,
  moduleFiles as generateModuleFiles,
  moduleFor,
  resolveLogLevel,
  type DocsOptions,
  type GeneratedModule,
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

export function loadModule(index: DocIndex, id: string): GeneratedModule | undefined {
  return moduleFor(vitestTestAdapter, index, id);
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
  let session = DdtSession.fromSources(vitestTestAdapter, new Map(), process.cwd());

  return {
    name: "vite-plugin-ddtds",
    enforce: "pre",
    config(config) {
      const root = config.test?.root ?? config.root ?? process.cwd();
      session = DdtSession.fromFiles(vitestTestAdapter, { ...docs, root });
      for (const { id, block } of session.index.fences()) {
        logger.debug("{file}:{line} -> {id}", () => ({
          file: block.details.file,
          line: block.line,
          id: relative(root, id),
        }));
      }
      const docFiles = [...session.index.docs()].map(([doc]) => doc);
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
      logger.info("Total: {size} tests", { size: session.index.size });
    },
    configureVitest({ defineCacheKeyGenerator }) {
      // opt out of caching markdown fences and files
      // they are cheap and imports are still cached 
      // the file system module cache is on by default > v5.0.4
      //
      // oxlint-disable-next-line typescript/no-unnecessary-condition vitest 4 interop
      defineCacheKeyGenerator?.(({ id }) =>
        session.index.hasDoc(id) || session.index.fence(id) ? false : undefined,
      );
    },
    watchChange(id) {
      session.refresh(id);
    },
    resolveId(source, importer, resolveOptions) {
      if (session.index.fence(source)) return source;
      if (!importer || !session.index.hasDoc(importer)) return undefined;
      const fromRoot = join(session.index.root, "package.json");
      return this.resolve(source, fromRoot, { ...resolveOptions, skipSelf: true });
    },
    load(id) {
      const fence = session.index.fence(id);
      if (fence) this.addWatchFile(fence.doc);
      return session.module(id);
    },
  };
}
