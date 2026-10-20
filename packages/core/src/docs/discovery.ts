import { globSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defaultDocsExclude, defaultDocsInclude, type DocsConfig } from "../config.ts";

export function findDocs(root: string, include: string[], exclude: string[]): string[] {
  return globSync(include, { cwd: root, exclude }).map((path) => resolve(root, path));
}

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
