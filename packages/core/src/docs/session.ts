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
  public index: DocIndex;

  private constructor(adapter: TestAdapter, index: DocIndex, tracked: Set<string> | "all") {
    this.#adapter = adapter;
    this.#tracked = tracked;
    this.index = index;
  }

  public static open(adapter: TestAdapter, root: string): DdtSession {
    const index = DocIndex.fromSources(new Map(), { root, moduleDir: join(root, "__ddtds__") });
    return new DdtSession(adapter, index, "all");
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
      new Set(sources.keys()),
    );
  }

  public static fromFiles(adapter: TestAdapter, config: DocsConfig): DdtSession {
    const { root, include, exclude } = resolveDocsOptions(config);
    return DdtSession.fromSources(adapter, readDocs(root, include, exclude), root);
  }

  public tracks(id: string): boolean {
    const doc = resolve(this.index.root, id);
    if (this.#tracked === "all") return isMarkdownFile(doc) || isSourceFile(doc);
    return this.#tracked.has(doc) || this.index.hasDoc(doc);
  }

  public refresh(id: string): void {
    const doc = resolve(this.index.root, id);
    if (isMarkdownFile(doc) || this.tracks(doc)) this.update(doc, readFileSync(doc, "utf8"));
  }

  /** Reindexes a doc from source the host already read */
  public update(id: string, source: string): void {
    const doc = resolve(this.index.root, id);
    if (this.#tracked !== "all") this.#tracked.add(doc);
    this.index = this.index.withDoc(doc, source);
  }

  /** Id to run in place of a doc with fences */
  public entry(path: string): string | undefined {
    const doc = resolve(this.index.root, path);
    if (!this.tracks(doc)) return undefined;
    this.refresh(doc);
    return this.index.fencesOf(doc).length > 0 ? this.index.entryId(doc) : undefined;
  }

  /** Module for an entry or fence id, rereading an entry's doc */
  public load(id: string): GeneratedModule | undefined {
    const doc = this.index.docOfEntry(id);
    if (doc !== undefined) this.refresh(doc);
    return moduleFor(this.#adapter, this.index, id);
  }
}
