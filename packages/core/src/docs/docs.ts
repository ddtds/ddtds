import { createHash } from "node:crypto";
import { join, relative, sep } from "node:path";
import { parseCodeFences, type CodeBlock } from "../fences/blocks.ts";
import { isSourceFile } from "../fences/doc-kinds.ts";
import { parseJsDocFences } from "../fences/jsdoc.ts";

export type Fence = Readonly<{
  id: string;
  doc: string;
  block: CodeBlock;
}>;

const ENTRY_QUERY = "?ddtds";

export type IndexOptions = Readonly<{ root: string; moduleDir: string }>;

export class DocIndex {
  readonly #options: IndexOptions;
  readonly #docs: Map<string, readonly Fence[]>;
  readonly #fences: Map<string, Fence>;
  readonly #sources: Map<string, string>;

  private constructor(
    options: IndexOptions,
    docs: Map<string, readonly Fence[]>,
    fences: Map<string, Fence>,
    sources: Map<string, string>,
  ) {
    this.#options = options;
    this.#docs = docs;
    this.#fences = fences;
    this.#sources = sources;
  }

  public static fromSources(sources: ReadonlyMap<string, string>, options: IndexOptions): DocIndex {
    const docs = new Map<string, readonly Fence[]>();
    for (const [doc, source] of sources) {
      const fences = parseFences(options, doc, source);
      if (fences.length > 0) docs.set(doc, fences);
    }
    return new DocIndex(options, docs, allFences(docs), new Map(sources));
  }

  public replaceDoc(doc: string, source: string): void {
    this.#dropFences(doc);
    const fences = parseFences(this.#options, doc, source);
    this.#docs.set(doc, fences);
    this.#sources.set(doc, source);
    for (const fence of fences) this.#fences.set(fence.id, fence);
  }

  public removeDoc(doc: string): void {
    this.#dropFences(doc);
    this.#docs.delete(doc);
    this.#sources.delete(doc);
  }

  #dropFences(doc: string): void {
    for (const fence of this.#docs.get(doc) ?? []) this.#fences.delete(fence.id);
  }

  public get root(): string {
    return this.#options.root;
  }

  public get size(): number {
    return this.#fences.size;
  }

  public docs(): MapIterator<[string, readonly Fence[]]> {
    return this.#docs.entries();
  }

  public fences(): MapIterator<Fence> {
    return this.#fences.values();
  }

  public hasDoc(doc: string): boolean {
    return this.#docs.has(doc);
  }

  public fencesOf(doc: string): readonly Fence[] {
    return this.#docs.get(doc) ?? [];
  }

  public fence(id: string): Fence | undefined {
    return this.#fences.get(id);
  }

  public sourceOf(doc: string): string | undefined {
    return this.#sources.get(doc);
  }

  /** Doc path plus a query, so watchers see the doc and importers get the file */
  public entryId(doc: string): string {
    return `${doc}${ENTRY_QUERY}`;
  }

  /** Doc behind an entry id */
  public docOfEntry(id: string): string | undefined {
    if (!id.endsWith(ENTRY_QUERY)) return undefined;
    const doc = id.slice(0, -ENTRY_QUERY.length);
    return this.hasDoc(doc) ? doc : undefined;
  }
}

function allFences(docs: ReadonlyMap<string, readonly Fence[]>): Map<string, Fence> {
  const fences = new Map<string, Fence>();
  for (const doc of docs.values()) for (const fence of doc) fences.set(fence.id, fence);
  return fences;
}

function parseFences({ root, moduleDir }: IndexOptions, doc: string, source: string): Fence[] {
  const parse = isSourceFile(doc) ? parseJsDocFences : parseCodeFences;
  const blocks = parse(source, relative(root, doc));
  if (blocks.length === 0) return [];
  const name = flatName(root, doc);
  return blocks.map((block) => ({
    id: join(moduleDir, `${name}_${block.line}_${contentHash(block)}.${block.outputExtension}`),
    doc,
    block,
  }));
}

/**
 * hashes code fence content and annotations
 * stable hashes enable caching for some runners
 */
function contentHash(block: CodeBlock): string {
  const input = JSON.stringify([block.details.annotation, block.code]);
  return createHash("sha1").update(input).digest("hex").slice(0, 8);
}

/**
 * Flattens a doc path to a name. The separator is escaped and `_` is doubled, so
 * paths that would otherwise alias stay distinct: `a/b.md` → `a_sb.md`, `a_b.md` → `a__b.md`
 */
function flatName(root: string, doc: string): string {
  return relative(root, doc).replace(/[_/\\]/g, (char) =>
    char === "_" ? "__" : char === sep ? "_s" : char,
  );
}
