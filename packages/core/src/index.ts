import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { globSync } from "tinyglobby";
import { defaultDocsExclude, defaultDocsInclude } from "./constants.ts";

export { CodeBlock, parseCodeFences } from "./blocks.ts";
export { defaultDocsInclude, defaultDocsExclude, defaultOutDir } from "./constants.ts";
export { DocIndex, type Fence, type IndexOptions } from "./docs.ts";
export { DdtCompileError } from "./compile-error.ts";

export type DocsOptions = {
  /** Globs of docs to test, relative to the root. Defaults to `defaultInclude` from `@ddtds/vitest/config` when unset or empty. */
  include?: string[];
  /** Globs of docs to skip, relative to the root. Replaces `defaultExclude` from `@ddtds/vitest/config` unless unset or empty. */
  exclude?: string[];
};

function findDocs(root: string, include: string[], exclude: string[]): string[] {
  return globSync(include, { cwd: root, ignore: exclude, absolute: true });
}

type DocsConfig = DocsOptions & {
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
  for (const [path, content] of files) writeFileSync(path, content);
}
