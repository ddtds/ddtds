import { join, relative } from "node:path";
import type { Plugin } from "vitest/config";
import type { TestProject } from "vitest/node";
import {
  DdtSession,
  DocIndex,
  defaultOutDir,
  moduleFiles as generateModuleFiles,
  moduleFor,
  type DdtOptions,
  type DocsOptions,
  type GeneratedModule,
} from "@ddtds/core";
import { getLogger } from "@logtape/logtape";
import { defaultGlobals, vitestAdapter, vitestTestAdapter } from "./adapter.ts";
import { configureLogging, createViteSink } from "./logging.ts";

export { defaultGlobals, vitestImports } from "./adapter.ts";
export type { CodeBlock, DocIndex, DocsOptions, Fence, LogLevel, StaticImport } from "@ddtds/core";
export {
  DdtCompileError,
  typedImports,
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

export type DdtPluginOptions = DocsOptions & DdtOptions;

export function ddtPlugin({
  logLevel,
  globals = defaultGlobals,
  ...docs
}: DdtPluginOptions = {}): Plugin {
  const vite = createViteSink();
  configureLogging(vite, logLevel);
  let project: TestProject | undefined;
  const adapter = vitestAdapter(globals);
  let session = DdtSession.fromSources(adapter, new Map(), process.cwd());
  const docFiles = (): string[] => Array.from(session.index.docs(), ([doc]) => doc);

  return {
    name: "vite-plugin-ddtds",
    enforce: "pre",
    config(config) {
      const root = config.test?.root ?? config.root ?? process.cwd();
      session = DdtSession.fromFiles(adapter, { ...docs, root });
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
