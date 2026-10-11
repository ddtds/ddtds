import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { defaultExclude, defaultInclude, type Plugin } from "vitest/config";
import {
  defaultOutDir,
  DocIndex,
  readDocs,
  resolveDocsOptions,
  typecheck as typecheckFences,
  type DdtCompileError,
  type Fence,
  type DocsOptions,
  type IndexOptions,
} from "@ddtds/core";
import { docModule, fenceModule } from "./codegen.ts";
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
  /** Fail fences with type errors, checked with the project's TypeScript 5 or 6 */
  typecheck?: boolean;
};

/** Fences use vitest's `expect` without importing it */
const vitestGlobals =
  'export {};\ndeclare global {\n  var expect: typeof import("vitest").expect;\n}';

export function ddtPlugin({ logLevel, typecheck, ...docs }: DdtPluginOptions = {}): Plugin {
  const logger = createLogger(parseLogLevel(process.env.DDT_LOG_LEVEL ?? logLevel));
  const moduleDirName = `__ddtds__-${randomUUID().slice(0, 8)}`;
  const indexOptions = (root: string): IndexOptions => ({
    root,
    moduleDir: join(root, moduleDirName),
    logger,
  });
  let index = DocIndex.fromSources(new Map(), indexOptions(process.cwd()));
  let typeErrors: Promise<Map<string, DdtCompileError>> | undefined;
  const typeErrorOf = async (fence: Fence): Promise<DdtCompileError | undefined> => {
    if (!typecheck) return undefined;
    typeErrors ??= typecheckFences(index.root, vitestGlobals, index.fences());
    return (await typeErrors).get(fence.id);
  };

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
      if (!index.hasDoc(id)) return;
      index = index.withDoc(id, readFileSync(id, "utf8"));
      typeErrors = undefined;
    },
    resolveId(source, importer, resolveOptions) {
      if (index.fence(source)) return source;
      if (!importer || !index.hasDoc(importer)) return undefined;
      const fromRoot = join(index.root, "package.json");
      return this.resolve(source, fromRoot, { ...resolveOptions, skipSelf: true });
    },
    async load(id) {
      if (index.hasDoc(id)) return docModule(index.fencesOf(id));
      const fence = index.fence(id);
      if (!fence) return undefined;
      this.addWatchFile(fence.doc);
      return fenceModule(fence, await typeErrorOf(fence));
    },
  };
}
