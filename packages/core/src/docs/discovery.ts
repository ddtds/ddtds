import { readFileSync } from "node:fs";
import { globSync } from "tinyglobby";
import { defaultDocsExclude, defaultDocsInclude } from "../constants.ts";

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
