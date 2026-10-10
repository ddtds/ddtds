import { join, relative, sep } from "node:path";
import { parseCodeFences, type CodeBlock } from "./blocks.ts";
import type { Logger } from "./logger.ts";

export type Fence = Readonly<{
  id: string;
  doc: string;
  block: CodeBlock;
}>;

export type IndexOptions = Readonly<{ root: string; moduleDir: string; logger: Logger }>;

export class DocIndex {
  readonly #options: IndexOptions;
  readonly #docs: ReadonlyMap<string, readonly Fence[]>;
  readonly #fences: ReadonlyMap<string, Fence>;

  private constructor(options: IndexOptions, docs: ReadonlyMap<string, readonly Fence[]>) {
    this.#options = options;
    this.#docs = docs;
    /** Transform docs map into a map of fence ids and code fences */
    this.#fences = new Map([...docs.values()].flat().map((fence) => [fence.id, fence]));
  }

  public static fromSources(sources: ReadonlyMap<string, string>, options: IndexOptions): DocIndex {
    const docs = new Map<string, readonly Fence[]>();
    for (const [doc, source] of sources) {
      const fences = parseFences(options, doc, source);
      if (fences.length > 0) docs.set(doc, fences);
    }
    return new DocIndex(options, docs);
  }

  public withDoc(doc: string, source: string): DocIndex {
    const docs = new Map(this.#docs);
    docs.set(doc, parseFences(this.#options, doc, source));
    return new DocIndex(this.#options, docs);
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

  public fencesOf(doc: string): readonly Fence[] | undefined {
    return this.#docs.get(doc);
  }

  public fence(id: string): Fence | undefined {
    return this.#fences.get(id);
  }

  public docModuleId(doc: string): string {
    return join(this.#options.moduleDir, `${flatName(this.#options.root, doc)}.test.ts`);
  }
}

function parseFences(
  { root, moduleDir, logger }: IndexOptions,
  doc: string,
  source: string,
): Fence[] {
  return parseCodeFences(source, relative(root, doc), logger).map((block) => ({
    id: join(moduleDir, `${flatName(root, doc)}_${block.line}.${block.outputExtension}`),
    doc,
    block,
  }));
}

function flatName(root: string, doc: string): string {
  return relative(root, doc).replaceAll(".", "_").replaceAll(sep, "_");
}
