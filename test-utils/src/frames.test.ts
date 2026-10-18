import { expect, test } from "vitest";
import { framesOf } from "./frames.ts";

const root = "/work/project";
const at = (line: string): string => `Error: boom\n    ${line}`;

test("reads a frame in a file URL as a path under the root", () => {
  expect(framesOf(at("at run (file:///work/project/my%20docs/a.md:3:7)"), root)).toEqual([
    { file: "my docs/a.md", line: 3, column: 7 },
  ]);
});

test("keeps only frames inside the root", () => {
  const stack = [
    "Error: boom",
    "    at run (/work/project/a.js:1:1)",
    "    at run (/work/other/b.js:2:2)",
    "    at run (/work/project-two/c.js:3:3)",
    "    at run (node:internal/test_runner/test:1402:25)",
  ].join("\n");
  expect(framesOf(stack, root)).toEqual([{ file: "a.js", line: 1, column: 1 }]);
});

test("keeps frames under the process directory", () => {
  const cwd = process.cwd();
  expect(framesOf(at(`at run (${cwd}/a.js:1:2)`), cwd)).toEqual([
    { file: "a.js", line: 1, column: 2 },
  ]);
});
