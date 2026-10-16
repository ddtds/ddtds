import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { TestAdapter } from "../codegen/adapter.ts";
import { moduleFor, type GeneratedModule } from "../codegen/modules.ts";
import { type DocsConfig, readDocs, resolveDocsOptions } from "./discovery.ts";
import { isMarkdownFile, isSourceFile } from "../fences/doc-kinds.ts";
import { DocIndex } from "./docs.ts";

export class DdtSession {
  readonly #adapter: TestAdapter;
  readonly #known: Set<string>;
  /** Tracks every doc it is asked about, for hosts that only learn their docs while running */
  readonly #open: boolean;
  public index: DocIndex;

  private constructor(
    adapter: TestAdapter,
    index: DocIndex,
    known: Iterable<string>,
    open = false,
  ) {
    this.#adapter = adapter;
    this.#known = new Set(known);
    this.#open = open;
    this.index = index;
  }

  /** A session that indexes each doc the first time a host asks about it */
  public static open(adapter: TestAdapter, root: string): DdtSession {
    const index = DocIndex.fromSources(new Map(), { root, moduleDir: join(root, "__ddtds__") });
    return new DdtSession(adapter, index, [], true);
  }

  public static fromSources(
    adapter: TestAdapter,
    sources: ReadonlyMap<string, string>,
    root: string,
  ): DdtSession {
    const moduleDir = join(root, "__ddtds__");
    return new DdtSession(
      adapter,
      DocIndex.fromSources(sources, { root, moduleDir }),
      sources.keys(),
    );
  }

  public static fromFiles(adapter: TestAdapter, config: DocsConfig): DdtSession {
    const { root, include, exclude } = resolveDocsOptions(config);
    return DdtSession.fromSources(adapter, readDocs(root, include, exclude), root);
  }

  public trackedDocs(): string[] {
    return [...new Set([...this.#known, ...[...this.index.docs()].map(([doc]) => doc)])];
  }

  public tracks(id: string): boolean {
    const doc = resolve(this.index.root, id);
    if (this.#open) return isMarkdownFile(doc) || isSourceFile(doc);
    return this.#known.has(doc) || this.index.hasDoc(doc);
  }

  public refresh(id: string): void {
    const doc = resolve(this.index.root, id);
    if (isMarkdownFile(doc) || this.tracks(doc)) this.update(doc, readFileSync(doc, "utf8"));
  }

  /** Reindexes a doc from source the host already read */
  public update(id: string, source: string): void {
    const doc = resolve(this.index.root, id);
    this.#known.add(doc);
    this.index = this.index.withDoc(doc, source);
  }

  /** The id a host runs in place of the doc at `path`, when the doc has fences */
  public entry(path: string): string | undefined {
    const doc = resolve(this.index.root, path);
    if (!this.tracks(doc)) return undefined;
    this.refresh(doc);
    return this.index.fencesOf(doc).length > 0 ? this.index.entryId(doc) : undefined;
  }

  /** The module for an entry or fence id. An entry's doc is read again first */
  public load(id: string): GeneratedModule | undefined {
    const doc = this.index.docOfEntry(id);
    if (doc !== undefined) this.refresh(doc);
    return moduleFor(this.#adapter, this.index, id);
  }
}
