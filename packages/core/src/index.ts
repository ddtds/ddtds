import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { globSync } from "tinyglobby";
import { parseCodeFences, type CodeBlock } from "./blocks.ts";
import { createLoggerFromEnv, type Logger } from "./logger.ts";

export { CodeBlock, parseCodeFences } from "./blocks.ts";
export { SUPPORTED_LANGS, ANNOTATIONS, type Annotation } from "./constants.ts";
export { wrapDdtTest } from "./error.ts";

export function findDocs(dir: string): string[] {
  return globSync("**/*.{md,mdx}", { cwd: dir, ignore: ["**/node_modules/**"], absolute: true });
}

export interface GenerateDeps {
  findDocs: (dir: string) => string[];
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

export function generate(
  searchDir: string,
  outputDir: string,
  renderBlockFile: (mdPath: string, block: CodeBlock) => string,
  deps?: Partial<GenerateDeps>,
): number {
  const resolved = { ...defaultGenerateDeps, ...deps };
  const { findDocs, readFile, writeFile, clearDir, logger } = resolved;

  const docs = findDocs(searchDir);
  if (docs.length === 0) {
    logger.info(`No .md or .mdx files found under ${searchDir}`);
    return 0;
  }

  clearDir(outputDir);
  let total = 0;

  for (const mdPath of docs) {
    const source = readFile(mdPath);
    const blocks = parseCodeFences(source, logger);
    if (blocks.length === 0) continue;
    total += blocks.length;

    const relPath = relative(searchDir, mdPath);
    const baseName = relPath.split(sep).join("_");
    logger.debug(`${relPath}: ${blocks.length} test${blocks.length === 1 ? "" : "s"}`);

    for (const block of blocks) {
      const outName = `${baseName}_${block.line}.test.${block.outputExtension}`;
      const outPath = join(outputDir, outName);
      writeFile(outPath, renderBlockFile(relPath, block));
      logger.trace(`  ${relPath}:${block.line} -> ${outPath}`);
    }
  }

  logger.info(`Total: ${total} tests`);
  return total;
}
