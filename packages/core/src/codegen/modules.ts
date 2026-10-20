import type { DocIndex } from "../docs/docs.ts";
import type { DdtCompileError } from "../fences/compile-error.ts";
import type { TestAdapter } from "./adapter.ts";
import type { GeneratedModule } from "./module-types.ts";
import { docModule, fenceModule } from "./render-module.ts";

export type { GeneratedModule } from "./module-types.ts";

/** Module for an entry or fence id */
export function moduleFor(
  adapter: TestAdapter,
  index: DocIndex,
  id: string,
  typeErrors?: ReadonlyMap<string, DdtCompileError>,
): GeneratedModule | undefined {
  const doc = index.docOfEntry(id);
  if (doc !== undefined) {
    return docModule(adapter, doc, index.fencesOf(doc), { source: index.sourceOf(doc) });
  }
  const fence = index.fence(id);
  if (!fence) return undefined;
  return fenceModule(adapter, fence, index.sourceOf(fence.doc), typeErrors?.get(fence.id));
}
