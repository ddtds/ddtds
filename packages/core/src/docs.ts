import { join, relative, sep } from "node:path";
import { parseCodeFences, type CodeBlock } from "./blocks.ts";
import type { Logger } from "./logger.ts";

export type Fence = {
  id: string;
  doc: string;
  block: CodeBlock;
};

export type DocIndex = {
  readonly docs: ReadonlyMap<string, readonly Fence[]>;
  readonly fences: ReadonlyMap<string, Fence>;
};

export type IndexOptions = { root: string; moduleDir: string; logger: Logger };

function flatName(root: string, doc: string): string {
  return relative(root, doc).replaceAll(".", "_").replaceAll(sep, "_");
}

export function docModuleName(root: string, doc: string): string {
  return `${flatName(root, doc)}.test.ts`;
}

function fencesOf(doc: string, source: string, options: IndexOptions): Fence[] {
  const { root, moduleDir, logger } = options;
  return parseCodeFences(source, relative(root, doc), logger).map((block) => ({
    id: join(moduleDir, `${flatName(root, doc)}_${block.line}.${block.outputExtension}`),
    doc,
    block,
  }));
}

function fromDocs(docs: ReadonlyMap<string, readonly Fence[]>): DocIndex {
  const fences = new Map([...docs.values()].flat().map((fence) => [fence.id, fence]));
  return { docs, fences };
}

export function indexDocs(sources: ReadonlyMap<string, string>, options: IndexOptions): DocIndex {
  const docs = new Map<string, Fence[]>();
  for (const [doc, source] of sources) {
    const fences = fencesOf(doc, source, options);
    if (fences.length > 0) docs.set(doc, fences);
  }
  return fromDocs(docs);
}
