import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { TestAdapter } from "../codegen/adapter.ts";
import { moduleFor, type GeneratedModule } from "../codegen/modules.ts";
import { type DocsConfig, readDocs, resolveDocsOptions } from "./discovery.ts";
import { isMarkdownFile, isSourceFile } from "../fences/doc-kinds.ts";
import { DocIndex } from "./docs.ts";

export class DdtSession {
  readonly #adapter: TestAdapter;
  /** `"all"` tracks any doc a host asks about */
  readonly #tracked: Set<string> | "all";
  #index: DocIndex;

  private constructor(
    adapter: TestAdapter,
    sources: ReadonlyMap<string, string>,
    root: string,
    tracked: Set<string> | "all",
  ) {
    this.#adapter = adapter;
    this.#tracked = tracked;
    this.#index = DocIndex.fromSources(sources, { root, moduleDir: join(root, "__ddtds__") });
  }

  public static open(adapter: TestAdapter, root: string): DdtSession {
    return new DdtSession(adapter, new Map(), root, "all");
  }

  public static fromSources(
    adapter: TestAdapter,
    sources: ReadonlyMap<string, string>,
    root: string,
  ): DdtSession {
    return new DdtSession(adapter, sources, root, new Set(sources.keys()));
  }

  public static fromFiles(adapter: TestAdapter, config: DocsConfig): DdtSession {
    const { root, include, exclude } = resolveDocsOptions(config);
    return DdtSession.fromSources(adapter, readDocs(root, include, exclude), root);
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

  /** Rereads a doc from disk */
  public refresh(id: string): void {
    const doc = resolve(this.root, id);
    if (!isMarkdownFile(doc) && !this.#tracks(doc)) return;
    if (this.#tracked !== "all") this.#tracked.add(doc);
    this.#index = this.#index.withDoc(doc, readFileSync(doc, "utf8"));
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

  /** Module for an entry or fence id, rereading an entry's doc */
  public load(id: string): GeneratedModule | undefined {
    const doc = this.#index.docOfEntry(id);
    if (doc !== undefined) this.refresh(doc);
    return moduleFor(this.#adapter, this.#index, id);
  }
}
