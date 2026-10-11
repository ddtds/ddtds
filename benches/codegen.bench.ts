import { bench, describe } from "vitest";
import { DocIndex } from "@ddtds/core";
import { moduleFiles } from "@ddtds/vitest";

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

describe("moduleFiles", () => {
  bench("generate test modules for 10 docs of 20 fences", () => {
    moduleFiles(index);
  });
});
