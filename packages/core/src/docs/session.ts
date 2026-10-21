import { readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { getLogger } from "@logtape/logtape";
import type { DdtCompileError } from "../fences/compile-error.ts";
import type { TestAdapter } from "../codegen/adapter.ts";
import { localName } from "../codegen/static-import.ts";
import { moduleFor, type GeneratedModule } from "../codegen/modules.ts";
import type { DocsConfig } from "../config.ts";
import { readDocs, resolveDocsOptions } from "./discovery.ts";
import { isMarkdownFile, isSourceFile } from "../fences/doc-kinds.ts";
import { DocIndex } from "./docs.ts";
import { TypeChecker } from "./typecheck.ts";

const logger = getLogger(["ddtds", "session"]);

export type SessionOptions = {
  /** Fails ts and tsx fences that have type errors. Needs `typescript` and a tsconfig.json */
  typecheck?: boolean;
};
/** Reads a doc, or `undefined` when the file is gone */
const readFromDisk = (doc: string): string | undefined => {
  try {
    return readFileSync(doc, "utf8");
  } catch (error) {
    // only a missing file is "gone"; permission and IO errors should surface
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
    throw error;
  }
};

export class DdtSession {
  readonly #adapter: TestAdapter;
  /** `"all"` tracks any doc a host asks about */
  readonly #tracked: Set<string> | "all";
  readonly #read: (doc: string) => string | undefined;
  #index: DocIndex;
  readonly #typeChecker: TypeChecker | undefined;
  #typed: Map<string, DdtCompileError> | undefined;

  private constructor(
    adapter: TestAdapter,
    sources: ReadonlyMap<string, string>,
    root: string,
    tracked: Set<string> | "all",
    read: (doc: string) => string | undefined,
    { typecheck = false }: SessionOptions = {},
  ) {
    this.#adapter = adapter;
    this.#typeChecker = typecheck ? new TypeChecker(root, adapter) : undefined;
    this.#tracked = tracked;
    this.#read = read;
    logger.debug("injecting {globals} into every fence", () => ({
      globals: adapter.fenceImports.map(localName),
    }));
    this.#index = DocIndex.fromSources(sources, { root, moduleDir: join(root, "__ddtds__") });
    for (const doc of sources.keys()) this.#logFences(doc);
  }

  public static open(adapter: TestAdapter, root: string, options?: SessionOptions): DdtSession {
    return new DdtSession(adapter, new Map(), root, "all", readFromDisk, options);
  }

  public static fromSources(
    adapter: TestAdapter,
    sources: ReadonlyMap<string, string>,
    root: string,
    read: (doc: string) => string | undefined = readFromDisk,
  ): DdtSession {
    return new DdtSession(adapter, sources, root, new Set(sources.keys()), read);
  }

  public static fromFiles(
    adapter: TestAdapter,
    { typecheck, ...config }: DocsConfig & SessionOptions,
  ): DdtSession {
    const { root, include, exclude } = resolveDocsOptions(config);
    logger.debug("looking for docs in {root} including {include} excluding {exclude}", {
      root,
      include,
      exclude,
    });
    const docs = readDocs(root, include, exclude);
    logger.debug("found {count} docs", { count: docs.size });
    return new DdtSession(adapter, docs, root, new Set(docs.keys()), readFromDisk, { typecheck });
  }

  public get index(): DocIndex {
    return this.#index;
  }

  public get root(): string {
    return this.#index.root;
  }

  #tracks(doc: string): boolean {
    if (this.#tracked === "all") return isMarkdownFile(doc) || isSourceFile(doc);
    return this.#tracked.has(doc) || this.#index.hasDoc(doc);
  }

  /** Rereads a doc from disk, forgetting it if the file is gone */
  public refresh(id: string): void {
    const doc = resolve(this.root, id);
    if (!isMarkdownFile(doc) && !this.#tracks(doc)) return;
    if (this.#tracked !== "all") this.#tracked.add(doc);
    const source = this.#read(doc);
    if (source === undefined) {
      this.#index.removeDoc(doc);
      this.#typed = undefined;
      return;
    }
    // indexing is pure in the source, so an unchanged doc needs no work
    if (this.#index.sourceOf(doc) === source) return;
    this.#index.replaceDoc(doc, source);
    this.#typed = undefined;
    this.#logFences(doc);
  }

  #logFences(doc: string): void {
    if (this.#index.fencesOf(doc).length === 0) {
      logger.trace("{doc} has no fences", () => ({ doc: relative(this.root, doc) }));
    }
    for (const { id, block } of this.#index.fencesOf(doc)) {
      logger.debug("{file}:{line} -> {id}", () => ({
        file: block.details.file,
        line: block.line,
        id: relative(this.root, id),
      }));
    }
  }

  /** Rereads a tracked doc and returns the id to run in its place, if it has fences */
  public entry(path: string): string | undefined {
    const doc = resolve(this.root, path);
    if (!this.#tracks(doc)) return undefined;
    this.refresh(doc);
    return this.#index.fencesOf(doc).length > 0 ? this.#index.entryId(doc) : undefined;
  }

  /** Whether `id` is an entry this session serves */
  public isEntry(id: string): boolean {
    return this.#index.docOfEntry(id) !== undefined;
  }

  /** The fence id for an absolute or root-relative specifier */
  public resolve(specifier: string): string | undefined {
    if (this.#index.fence(specifier)) return specifier;
    const fromRoot = join(this.root, specifier);
    return this.#index.fence(fromRoot) ? fromRoot : undefined;
  }

  public typeErrors(): Map<string, DdtCompileError> {
    this.#typed ??= this.#typeChecker?.check(this.#index) ?? new Map();
    return this.#typed;
  }

  /** Module for an entry or fence id, rereading an entry's doc */
  public load(id: string): GeneratedModule | undefined {
    const doc = this.#index.docOfEntry(id);
    if (doc !== undefined) this.refresh(doc);
    const typeErrors = this.#index.fence(id) ? this.typeErrors() : undefined;
    return moduleFor(this.#adapter, this.#index, id, typeErrors);
  }
}
