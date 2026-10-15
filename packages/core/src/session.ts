import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { TestAdapter } from "./codegen/adapter.ts";
import { moduleFor, type GeneratedModule } from "./codegen/modules.ts";
import { type DocsConfig, readDocs, resolveDocsOptions } from "./discovery.ts";
import { DocIndex } from "./docs.ts";

const docPattern = /\.mdx?$/;

export class DdtSession {
  readonly #adapter: TestAdapter;
  public index: DocIndex;

  private constructor(adapter: TestAdapter, index: DocIndex) {
    this.#adapter = adapter;
    this.index = index;
  }

  public static fromSources(
    adapter: TestAdapter,
    sources: ReadonlyMap<string, string>,
    root: string,
  ): DdtSession {
    const moduleDir = join(root, "__ddtds__");
    return new DdtSession(adapter, DocIndex.fromSources(sources, { root, moduleDir }));
  }

  public static fromFiles(adapter: TestAdapter, config: DocsConfig): DdtSession {
    const { root, include, exclude } = resolveDocsOptions(config);
    return DdtSession.fromSources(adapter, readDocs(root, include, exclude), root);
  }

  public refresh(id: string): void {
    if (!docPattern.test(id) && !this.index.hasDoc(id)) return;
    this.index = this.index.withDoc(id, readFileSync(id, "utf8"));
  }

  public module(id: string): GeneratedModule | undefined {
    return moduleFor(this.#adapter, this.index, id);
  }
}
