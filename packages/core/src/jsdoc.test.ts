import { expect, test } from "vitest";
import { DocIndex } from "./docs.ts";
import { parseJsDocFences } from "./jsdoc.ts";
import { createLogger } from "./logger.ts";

const silent = createLogger("silent");

test("finds code fences in JSDoc comments at their place in the file", () => {
  const source = [
    "// not a doc comment: ```ts run",
    "/* not JSDoc either */",
    "export class Counter {",
    "  /**",
    "   * Increments.",
    "   *",
    "   * ```ts run",
    "   * const counter = new Counter();",
    "   * ```",
    "   */",
    "  increment(): void {}",
    "}",
  ].join("\n");
  const blocks = parseJsDocFences(source, "src/counter.ts", silent);
  expect(blocks.map(({ details: { range, indent, contents } }) => ({ range, indent, contents })))
    .toMatchInlineSnapshot(`
      [
        {
          "contents": "const counter = new Counter();",
          "indent": 5,
          "range": {
            "end": {
              "column": 9,
              "line": 9,
            },
            "start": {
              "column": 6,
              "line": 7,
            },
          },
        },
      ]
    `);
  expect(blocks[0]?.positionAt(6)).toMatchInlineSnapshot(`
    {
      "column": 12,
      "line": 8,
    }
  `);
});

test("an index reads fences from JSDoc in source files", () => {
  const index = DocIndex.fromSources(
    new Map([
      ["/repo/src/one.ts", "/**\n * ```ts run\n * 1;\n * ```\n */\nexport const one = 1;\n"],
    ]),
    { root: "/repo", moduleDir: "/repo/__ddtds__", logger: silent },
  );
  expect([...index.fences()].map(({ id, block }) => `${id} ${block.line}`)).toMatchInlineSnapshot(`
    [
      "/repo/__ddtds__/src_one_ts_2.ts 2",
    ]
  `);
});
