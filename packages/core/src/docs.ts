import { join, relative, sep } from "node:path";
import { parseCodeFences, type CodeBlock } from "./blocks.ts";
import type { Logger } from "./logger.ts";

export type Fence = Readonly<{
  id: string;
  doc: string;
  block: CodeBlock;
}>;

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

/** Transform docs map into a map of fence ids and code fences */
function buildFenceIdsFromDocs(docs: ReadonlyMap<string, readonly Fence[]>): Map<string, Fence> {
  return new Map([...docs.values()].flat().map((fence) => [fence.id, fence]));
}

function withSources(
  docs: ReadonlyMap<string, readonly Fence[]>,
  sources: ReadonlyMap<string, string>,
  options: IndexOptions,
): Map<string, readonly Fence[]> {
  const next = new Map(docs);
  for (const [doc, source] of sources) {
    const fences = fencesOf(doc, source, options);
    if (fences.length > 0) next.set(doc, fences);
    else next.delete(doc);
  }
  return next;
}

export class DocIndex {
  readonly #options: IndexOptions;
  readonly #docs: ReadonlyMap<string, readonly Fence[]>;
  readonly #fences: ReadonlyMap<string, Fence>;

  private constructor(options: IndexOptions, docs: ReadonlyMap<string, readonly Fence[]>) {
    this.#options = options;
    this.#docs = docs;
    this.#fences = buildFenceIdsFromDocs(docs);
  }

  public static fromSources(sources: ReadonlyMap<string, string>, options: IndexOptions): DocIndex {
    return new DocIndex(options, withSources(new Map(), sources, options));
  }

  public withDoc(doc: string, source: string): DocIndex {
    const docs = withSources(this.#docs, new Map([[doc, source]]), this.#options);
    return new DocIndex(this.#options, docs);
  }

  public get size(): number {
    return this.#fences.size;
  }

  public docs(): Iterable<readonly [string, readonly Fence[]]> {
    return this.#docs.entries();
  }

  public fences(): Iterable<Fence> {
    return this.#fences.values();
  }
}
