import { test } from "vitest";
import { DocIndex } from "@ddtds/core";
import { loadModule } from "@ddtds/vitest";
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
    for (const id of fenceIds) loadModule(index, id);
  }).run();

  await bench("serve every doc module", () => {
    for (const id of docIds) loadModule(index, id);
  }).run();
});
