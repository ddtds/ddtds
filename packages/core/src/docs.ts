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
    return [...sources].reduce(
      (index, [doc, source]) => index.withDoc(doc, source),
      new DocIndex(options, new Map()),
    );
  }

  public withDoc(doc: string, source: string): DocIndex {
    const docs = new Map(this.#docs);
    const fences = this.#parse(doc, source);
    if (fences.length > 0) docs.set(doc, fences);
    else docs.delete(doc);
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

  public fencesOf(doc: string): readonly Fence[] | undefined {
    return this.#docs.get(doc);
  }

  public fence(id: string): Fence | undefined {
    return this.#fences.get(id);
  }

  public docModuleId(doc: string): string {
    return join(this.#options.moduleDir, `${this.#flatName(doc)}.test.ts`);
  }

  #parse(doc: string, source: string): Fence[] {
    const { root, moduleDir, logger } = this.#options;
    return parseCodeFences(source, relative(root, doc), logger).map((block) => ({
      id: join(moduleDir, `${this.#flatName(doc)}_${block.line}.${block.outputExtension}`),
      doc,
      block,
    }));
  }

  #flatName(doc: string): string {
    return relative(this.#options.root, doc).replaceAll(".", "_").replaceAll(sep, "_");
  }
}
