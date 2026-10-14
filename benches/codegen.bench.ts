import { test } from "vitest";
import { DocIndex } from "@ddtds/core";
import { loadModule } from "@ddtds/vitest";

function fence(i: number): string {
  return [
    "```ts run",
    'import { add } from "calc";',
    `const values = [${i}, ${i + 1}];`,
    `expect(add(...values)).toBe(${2 * i + 1});`,
    "```",
    "",
  ].join("\n");
}

const root = "/repo";
const sources = new Map(
  Array.from({ length: 10 }, (_, doc) => [
    `${root}/docs/guide-${doc}.md`,
    Array.from({ length: 20 }, (_, i) => fence(i)).join("\n"),
  ]),
);
const index = DocIndex.fromSources(sources, {
  root,
  moduleDir: `${root}/__ddtds__`,
});

const fenceIds = [...index.fences()].map((fence) => fence.id);
const docIds = index
  .docs()
  .map(([doc]) => doc)
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
