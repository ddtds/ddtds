import { join, relative } from "node:path";
import type { Plugin } from "vitest/config";
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
import { adapterFor, globalsIgnored, vitestTestAdapter, type GlobalsMode } from "./adapter.ts";
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

const WATCH_TRIGGER = /\.(?:mdx?|[cm]?[jt]sx?)$/;

export type DdtPluginOptions = DocsOptions & {
  /**
   * Precedence (highest to lowest):
   *   1. `DDT_LOG_LEVEL` environment variable
   *   2. `logLevel` option
   *   3. `"info"` (default)
   */
  logLevel?: LogLevel;
  /**
   * Names doc tests can use without importing them, only for doc tests. Defaults to `"minimal"`
   * - `"off"`: none
   * - `"minimal"`: `expect` and `vi`, what makes sense inside a running test
   * - `"full"`: `minimal` plus the rest of [vitest globals](https://vitest.dev/config/globals)
   *   such as `describe`, `test` and `it`, for parity with `test.globals`. Does nothing if
   *   globals are enabled project wide
   */
  globals?: GlobalsMode;
};

export function ddtPlugin({
  logLevel,
  globals = "minimal",
  ...docs
}: DdtPluginOptions = {}): Plugin {
  const vite = createViteSink();
  configureLogging(resolveLogLevel(logLevel), vite);
  let project: TestProject | undefined;
  let session = DdtSession.fromSources(vitestTestAdapter, new Map(), process.cwd());
  const docFiles = (): string[] => Array.from(session.index.docs(), ([doc]) => doc);

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
      const included = new Set(docFiles());
      return {
        test: {
          watchTriggerPatterns: [
            {
              pattern: WATCH_TRIGGER,
              testsToRun(file: string): string[] | undefined {
                if (!project || included.has(file) || !session.entry(file)) return undefined;
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
      const { config } = context.project;
      if (globalsIgnored(globals, config.globals)) {
        logger.warn('`globals: "full"` has no effect, vitest `test.globals` is already enabled');
      }
      session.useAdapter(adapterFor(globals, config.globals));
      config.include = [...config.include, ...docFiles()];
      config.exclude = [...config.exclude, join(session.root, defaultOutDir, "**")];
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
      if (!importer || importer === join(session.root, "index.html")) {
        const entry = session.entry(source);
        if (entry !== undefined) return entry;
      }
      // a cached doc module imports fences by root-relative urls
      const fence = session.resolve(source);
      if (fence !== undefined) return fence;
      if (!importer || !session.isEntry(importer)) return undefined;
      const fromRoot = join(session.root, "package.json");
      return this.resolve(source, fromRoot, { ...resolveOptions, skipSelf: true });
    },
    load(id) {
      const fence = session.index.fence(id);
      if (fence) this.addWatchFile(fence.doc);
      return session.load(id);
    },
  };
}
