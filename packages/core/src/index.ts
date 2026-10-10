import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "tinyglobby";
import { defaultDocsExclude, defaultDocsInclude } from "./constants.ts";

export { CodeBlock, parseCodeFences } from "./blocks.ts";
export {
  SUPPORTED_LANGS,
  OUTPUT_EXTENSIONS,
  type Lang,
  ANNOTATIONS,
  type Annotation,
  defaultDocsInclude,
  defaultDocsExclude,
  defaultOutDir,
} from "./constants.ts";
export { wrapDdtTest } from "./error.ts";
export { docModuleName, indexDocs, type DocIndex, type Fence, type IndexOptions } from "./docs.ts";
export {
  DdtCompileError,
  type CompileDiagnostic,
  type CompileErrorDetails,
  type CompileLabel,
  type Position,
} from "./compile-error.ts";

export type DocsOptions = {
  /** Globs of docs to test, relative to the root. Defaults to `defaultDocsInclude` when unset or empty. */
  include?: string[];
  /** Globs of docs to skip, relative to the root. Replaces `defaultDocsExclude` unless unset or empty. */
  exclude?: string[];
};

export function findDocs(root: string, include: string[], exclude: string[]): string[] {
  return globSync(include, { cwd: root, ignore: exclude, absolute: true });
}

export type DocsConfig = DocsOptions & {
  /** Directory that `include` and `exclude` are relative to. */
  root: string;
};

export function resolveDocsOptions({ root, include, exclude }: DocsConfig): Required<DocsConfig> {
  return {
    root,
    include: include?.length ? include : defaultDocsInclude,
    exclude: exclude?.length ? exclude : defaultDocsExclude,
  };
}

export function readDocs(root: string, include: string[], exclude: string[]): Map<string, string> {
  return new Map(findDocs(root, include, exclude).map((doc) => [doc, readFileSync(doc, "utf8")]));
}

export function writeFiles(dir: string, files: ReadonlyMap<string, string>): void {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const [name, content] of files) writeFileSync(join(dir, name), content);
}
