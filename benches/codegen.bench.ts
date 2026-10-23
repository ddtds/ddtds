import { test } from "vitest";
import { moduleFor } from "@ddtds/core/codegen";
import { DocIndex } from "@ddtds/core/docs";
import { adapter } from "./adapter.ts";
import { fenceDocs, options } from "./fixtures.ts";

const index = DocIndex.fromSources(fenceDocs(10, 20), options);

const fenceIds = Array.from(index.fences(), (fence) => fence.id);
const docIds = index
  .docs()
  .map(([doc]) => index.entryId(doc))
  .toArray();

/** What `ddtPlugin`'s `load` serves during a test run: one module per doc and fence. */
test("vitest plugin load", async ({ bench }) => {
  await bench("serve 200 fence modules", () => {
    for (const id of fenceIds) moduleFor(adapter, index, id);
  }).run();

  await bench("serve 10 doc modules", () => {
    for (const id of docIds) moduleFor(adapter, index, id);
  }).run();
});
