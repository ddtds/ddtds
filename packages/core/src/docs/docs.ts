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
  readonly #docs: ReadonlyMap<string, readonly Fence[]>;
  readonly #fences: ReadonlyMap<string, Fence>;
  readonly #sources: ReadonlyMap<string, string>;

  private constructor(
    options: IndexOptions,
    docs: ReadonlyMap<string, readonly Fence[]>,
    sources: ReadonlyMap<string, string>,
  ) {
    this.#options = options;
    this.#docs = docs;
    this.#sources = sources;
    /** Transform docs map into a map of fence ids and code fences */
    this.#fences = new Map([...docs.values()].flat().map((fence) => [fence.id, fence]));
  }

  public static fromSources(sources: ReadonlyMap<string, string>, options: IndexOptions): DocIndex {
    const docs = new Map<string, readonly Fence[]>();
    for (const [doc, source] of sources) {
      const fences = parseFences(options, doc, source);
      if (fences.length > 0) docs.set(doc, fences);
    }
    return new DocIndex(options, docs, sources);
  }

  public withDoc(doc: string, source: string): DocIndex {
    const docs = new Map(this.#docs);
    docs.set(doc, parseFences(this.#options, doc, source));
    const sources = new Map(this.#sources);
    sources.set(doc, source);
    return new DocIndex(this.#options, docs, sources);
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

  public fences(): Iterable<Fence> {
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

  public docModuleId(doc: string): string {
    return join(this.#options.moduleDir, `${flatName(this.#options.root, doc)}.test.ts`);
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

function parseFences({ root, moduleDir }: IndexOptions, doc: string, source: string): Fence[] {
  const parse = isSourceFile(doc) ? parseJsDocFences : parseCodeFences;
  return parse(source, relative(root, doc)).map((block) => ({
    id: join(
      moduleDir,
      `${flatName(root, doc)}_${block.line}_${contentHash(block)}.${block.outputExtension}`,
    ),
    doc,
    block,
  }));
}

/**
 * hashes code fence content and annotations
 * stable bashes enable caching for some runners
 */
function contentHash(block: CodeBlock): string {
  const input = JSON.stringify([block.details.annotation, block.code]);
  return createHash("sha1").update(input).digest("hex").slice(0, 8);
}

function flatName(root: string, doc: string): string {
  return relative(root, doc).replaceAll(".", "_").replaceAll(sep, "_");
}
