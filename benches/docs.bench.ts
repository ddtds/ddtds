import { test } from "vitest";
import { DocIndex, parseCodeFences, type IndexOptions } from "@ddtds/core";

/** A section of a guide: prose, a list with an indented fence, a top-level fence, a skipped one */
function section(i: number): string {
  return [
    `## Step ${i}`,
    "",
    "Some prose with `inline code`, **emphasis** and a [link](https://example.com).",
    "",
    "1. Install the package:",
    "",
    "   ```sh",
    "   npm install calc",
    "   ```",
    "",
    "2. Add numbers:",
    "",
    "   ```ts run",
    '   import { add } from "calc";',
    `   expect(add(${i}, 1)).toBe(${i + 1});`,
    "   ```",
    "",
    "```js run",
    `const values = [${i}, ${i + 1}, ${i + 2}];`,
    "expect(values.map((value) => value * 2)).toHaveLength(3);",
    "```",
    "",
    "```ts",
    "// not annotated, so never run",
    "```",
    "",
  ].join("\n");
}

function guide(sections: number): string {
  return Array.from({ length: sections }, (_, i) => section(i)).join("\n");
}

const doc = guide(50);
/** The same guide in MDX, with components around some of its sections */
const mdx = Array.from({ length: 50 }, (_, i) =>
  i % 5 === 0 ? `<Steps>\n\n${section(i)}\n</Steps>\n` : section(i),
).join("\n");

const root = "/repo";
const options: IndexOptions = { root, moduleDir: `${root}/__ddtds__` };
const sources = new Map(
  Array.from({ length: 20 }, (_, i) => [`${root}/docs/guide-${i}.md`, guide(10)]),
);
const index = DocIndex.fromSources(sources, options);

test("parseCodeFences", async ({ bench }) => {
  await bench("find fences in a 50 section markdown doc", () => {
    parseCodeFences(doc, "guide.md");
  }).run();

  await bench("find fences in a 50 section MDX doc", () => {
    parseCodeFences(mdx, "guide.mdx");
  }).run();
});

test("DocIndex", async ({ bench }) => {
  await bench("index 20 docs of 10 sections", () => {
    DocIndex.fromSources(sources, options);
  }).run();

  await bench("reindex one changed doc", () => {
    index.withDoc(`${root}/docs/guide-0.md`, guide(11));
  }).run();
});
