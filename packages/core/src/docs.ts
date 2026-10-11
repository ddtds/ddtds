import { join, relative, sep } from "node:path";
import { parseCodeFences, type CodeBlock } from "./blocks.ts";
import type { Logger } from "./logger.ts";

export type Fence = Readonly<{
  id: string;
  doc: string;
  block: CodeBlock;
}>;

/** A doc's fences, or the error that kept it from being read, e.g. invalid MDX */
export type Doc =
  | Readonly<{ tag: "fences"; fences: readonly Fence[] }>
  | Readonly<{ tag: "invalid"; message: string }>;

export type IndexOptions = Readonly<{ root: string; moduleDir: string; logger: Logger }>;

export class DocIndex {
  readonly #options: IndexOptions;
  readonly #docs: ReadonlyMap<string, Doc>;
  readonly #fences: ReadonlyMap<string, Fence>;

  private constructor(options: IndexOptions, docs: ReadonlyMap<string, Doc>) {
    this.#options = options;
    this.#docs = docs;
    const fences = [...docs.values()].flatMap((doc) => (doc.tag === "fences" ? doc.fences : []));
    this.#fences = new Map(fences.map((fence) => [fence.id, fence]));
  }

  public static fromSources(sources: ReadonlyMap<string, string>, options: IndexOptions): DocIndex {
    const docs = new Map<string, Doc>();
    for (const [path, source] of sources) {
      const doc = parseDoc(options, path, source);
      if (doc.tag === "invalid" || doc.fences.length > 0) docs.set(path, doc);
    }
    return new DocIndex(options, docs);
  }

  public withDoc(doc: string, source: string): DocIndex {
    const docs = new Map(this.#docs);
    docs.set(doc, parseDoc(this.#options, doc, source));
    return new DocIndex(this.#options, docs);
  }

  public get root(): string {
    return this.#options.root;
  }

  public get size(): number {
    return this.#fences.size;
  }

  public docs(): MapIterator<[string, Doc]> {
    return this.#docs.entries();
  }

  public fences(): Iterable<Fence> {
    return this.#fences.values();
  }

  public hasDoc(doc: string): boolean {
    return this.#docs.has(doc);
  }

  public doc(path: string): Doc | undefined {
    return this.#docs.get(path);
  }

  public fence(id: string): Fence | undefined {
    return this.#fences.get(id);
  }

  public docModuleId(doc: string): string {
    return join(this.#options.moduleDir, `${flatName(this.#options.root, doc)}.test.ts`);
  }
}

function parseDoc(options: IndexOptions, doc: string, source: string): Doc {
  try {
    return { tag: "fences", fences: parseFences(options, doc, source) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { tag: "invalid", message };
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
