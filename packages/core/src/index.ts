import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { globSync } from "tinyglobby";
import { parseCodeFences, type CodeBlock } from "./blocks.ts";
import { defaultDocsExclude, defaultDocsInclude, defaultOutputDir } from "./constants.ts";
import { createLoggerFromEnv, type Logger } from "./logger.ts";

export { CodeBlock, parseCodeFences } from "./blocks.ts";
export {
  SUPPORTED_LANGS,
  ANNOTATIONS,
  type Annotation,
  defaultDocsInclude,
  defaultDocsExclude,
  defaultOutputDir,
} from "./constants.ts";
export { DdtSyntaxError, wrapDdtTest } from "./error.ts";

export type DocsOptions = {
  /** Globs of docs to test, relative to the root. Defaults to `defaultDocsInclude` when unset or empty. */
  include?: string[];
  /** Globs of docs to skip, relative to the root. Replaces `defaultDocsExclude` unless unset or empty. */
  exclude?: string[];
  /** Directory to write test files, relative to the root. Defaults to `defaultOutputDir`. */
  outputDir?: string;
};

export function findDocs(root: string, include: string[], exclude: string[]): string[] {
  return globSync(include, { cwd: root, ignore: exclude, absolute: true });
}

export interface GenerateDeps {
  findDocs: typeof findDocs;
  readFile: (path: string) => string;
  writeFile: (path: string, content: string) => void;
  clearDir: (path: string) => void;
  logger: Logger;
}

const defaultGenerateDeps: GenerateDeps = {
  findDocs,
  readFile: (path) => readFileSync(path, "utf8"),
  writeFile: writeFileSync,
  clearDir: (path) => {
    rmSync(path, { recursive: true, force: true });
    mkdirSync(path, { recursive: true });
  },
  logger: createLoggerFromEnv(),
};

export type GenerateOptions = DocsOptions & {
  /** Directory that `include`, `exclude` and `outputDir` are relative to. */
  root: string;
};

export function resolveDocsOptions({
  root,
  include,
  exclude,
  outputDir,
}: GenerateOptions): Required<GenerateOptions> {
  return {
    root,
    include: include?.length ? include : defaultDocsInclude,
    exclude: exclude?.length ? exclude : defaultDocsExclude,
    outputDir: resolve(root, outputDir ?? defaultOutputDir),
  };
}

export function generate(
  options: GenerateOptions,
  renderBlockFile: (mdPath: string, block: CodeBlock) => string,
  deps?: Partial<GenerateDeps>,
): number {
  const resolved = { ...defaultGenerateDeps, ...deps };
  const { findDocs, readFile, writeFile, clearDir, logger } = resolved;
  const { root, include, exclude, outputDir: output } = resolveDocsOptions(options);

  const docs = findDocs(root, include, exclude);
  if (docs.length === 0) {
    logger.info(`No docs found under ${root}`);
    return 0;
  }

  clearDir(output);
  let total = 0;

  for (const mdPath of docs) {
    const source = readFile(mdPath);
    const blocks = parseCodeFences(source, logger);
    if (blocks.length === 0) continue;
    total += blocks.length;

    const relPath = relative(root, mdPath);
    const baseName = relPath.replaceAll(".", "_").replaceAll(sep, "_");
    logger.debug(`${relPath}: ${blocks.length} test${blocks.length === 1 ? "" : "s"}`);

    for (const block of blocks) {
      const outName = `${baseName}_${block.line}.test.${block.outputExtension}`;
      const outPath = join(output, outName);
      writeFile(outPath, renderBlockFile(relPath, block));
      logger.trace(`  ${relPath}:${block.line} -> ${outPath}`);
    }
  }

  logger.info(`Total: ${total} tests`);
  return total;
}
