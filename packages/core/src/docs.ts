import { join, relative, sep } from "node:path";
import { parseCodeFences, type CodeBlock } from "./blocks.ts";
import type { Logger } from "./logger.ts";

export type Fence = {
  /** Path of the fence module, inside the output directory. */
  id: string;
  doc: string;
  block: CodeBlock;
};

export type DocIndex = {
  readonly docs: ReadonlyMap<string, readonly Fence[]>;
  readonly fences: ReadonlyMap<string, Fence>;
};

export type IndexOptions = { root: string; outputDir: string; logger: Logger };

function flatName(root: string, doc: string): string {
  return relative(root, doc).replaceAll(".", "_").replaceAll(sep, "_");
}

/** e.g. `docs/guide.md` gives `docs_guide_md.test.ts` */
export function docModuleName(root: string, doc: string): string {
  return `${flatName(root, doc)}.test.ts`;
}

function fencesOf(doc: string, source: string, options: IndexOptions): Fence[] {
  const { root, outputDir, logger } = options;
  return parseCodeFences(source, relative(root, doc), logger).map((block) => ({
    id: join(outputDir, `${flatName(root, doc)}_${block.line}.${block.outputExtension}`),
    doc,
    block,
  }));
}

function fromDocs(docs: ReadonlyMap<string, readonly Fence[]>): DocIndex {
  const fences = new Map([...docs.values()].flat().map((fence) => [fence.id, fence]));
  return { docs, fences };
}

/** Indexes the runnable fences of each doc, skipping docs without any. */
export function indexDocs(sources: ReadonlyMap<string, string>, options: IndexOptions): DocIndex {
  const docs = new Map<string, Fence[]>();
  for (const [doc, source] of sources) {
    const fences = fencesOf(doc, source, options);
    if (fences.length > 0) docs.set(doc, fences);
  }
  return fromDocs(docs);
}
