import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { TestAdapter } from "./codegen/adapter.ts";
import { moduleFor, type GeneratedModule } from "./codegen/modules.ts";
import { type DocsConfig, readDocs, resolveDocsOptions } from "./discovery.ts";
import { DocIndex } from "./docs.ts";

const docPattern = /\.mdx?$/;

export class DdtSession {
  readonly #adapter: TestAdapter;
  readonly #known: Set<string>;
  public index: DocIndex;

  private constructor(adapter: TestAdapter, index: DocIndex, known: Iterable<string>) {
    this.#adapter = adapter;
    this.#known = new Set(known);
    this.index = index;
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
    return this.#known.has(doc) || this.index.hasDoc(doc);
  }

  public refresh(id: string): void {
    const doc = resolve(this.index.root, id);
    if (!docPattern.test(doc) && !this.index.hasDoc(doc)) return;
    this.index = this.index.withDoc(doc, readFileSync(doc, "utf8"));
  }

  public module(id: string): GeneratedModule | undefined {
    return moduleFor(this.#adapter, this.index, id);
  }
}
