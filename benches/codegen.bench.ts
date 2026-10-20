import { test } from "vitest";
import { moduleFor } from "@ddtds/core/codegen";
import { DocIndex } from "@ddtds/core/docs";
import { adapter } from "./adapter.ts";
import { fenceSources, options } from "./fixtures.ts";

const index = DocIndex.fromSources(fenceSources(10, 20), options);

const fenceIds = Array.from(index.fences(), (fence) => fence.id);
const docIds = index
  .docs()
  .map(([doc]) => index.entryId(doc))
  .toArray();

/** What `ddtPlugin`'s `load` serves during a test run: one module per doc and fence. */
test("vitest plugin load", async ({ bench }) => {
  await bench("serve every fence module", () => {
    for (const id of fenceIds) moduleFor(adapter, index, id);
  }).run();

  await bench("serve every doc module", () => {
    for (const id of docIds) moduleFor(adapter, index, id);
  }).run();
});
