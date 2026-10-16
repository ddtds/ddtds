import { join, relative } from "node:path";
import { defaultExclude, defaultInclude, type Plugin } from "vitest/config";
import type { TestProject } from "vitest/node";
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
  let project: TestProject | undefined;
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
      const included = new Set(docFiles);
      const buildOutput = join(root, defaultOutDir, "**");
      return {
        test: {
          include: [...(config.test?.include ? [] : defaultInclude), ...docFiles],
          exclude: [...(config.test?.exclude ? [] : defaultExclude), buildOutput],
          watchTriggerPatterns: [
            {
              pattern: /\.(?:mdx?|[cm]?[jt]sx?)$/,
              testsToRun(file: string): string[] | undefined {
                if (!session.tracks(file) || included.has(file)) return undefined;
                session.refresh(file);
                if (!project || session.index.fencesOf(file).length === 0) return undefined;
                included.add(file);
                project.config.include.push(
                  relative(project.config.dir || project.config.root, file),
                );
                return project.matchesTestGlob(file) ? [file] : undefined;
              },
            },
          ],
        },
      };
    },
    configureVitest(context) {
      project = context.project;
    },
    configResolved(config) {
      vite.attach(config.logger);
      logger.info("Total: {size} tests", { size: session.index.size });
    },
    watchChange(id) {
      session.refresh(id);
    },
    resolveId(source, importer, resolveOptions) {
      // Vite resolves top-level requests, like test files, from the root's index.html
      if (!importer || importer === join(session.index.root, "index.html")) {
        const entry = session.entry(source);
        if (entry !== undefined) return entry;
      }
      // A cached doc module carries the fence imports Vite rewrote to
      // root-relative urls, so accept those too, not just absolute ids.
      const fence = session.index.fence(source) ? source : join(session.index.root, source);
      if (session.index.fence(fence)) return fence;
      if (!importer || !session.index.docOfEntry(importer)) return undefined;
      const fromRoot = join(session.index.root, "package.json");
      return this.resolve(source, fromRoot, { ...resolveOptions, skipSelf: true });
    },
    load(id) {
      const fence = session.index.fence(id);
      if (fence) this.addWatchFile(fence.doc);
      return session.load(id);
    },
  };
}
