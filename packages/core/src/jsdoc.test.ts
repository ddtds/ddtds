import { expect, test } from "vitest";
import { DocIndex } from "./docs.ts";
import { parseJsDocFences } from "./jsdoc.ts";

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
  const blocks = parseJsDocFences(source, "src/counter.ts");
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
    { root: "/repo", moduleDir: "/repo/__ddtds__" },
  );
  expect([...index.fences()].map(({ id, block }) => `${id} ${block.line}`)).toMatchInlineSnapshot(`
    [
      "/repo/__ddtds__/src_one_ts_2_b41e6c30.ts 2",
    ]
  `);
});

test("maps each line of a fence by its own prefix", () => {
  const source = [
    "/**",
    " * ```ts run",
    "   * const a = 1;",
    "  *   const b = 2;",
    " * ```",
    " */",
  ].join("\n");
  const [block] = parseJsDocFences(source, "src/odd.ts");
  expect(block?.details.range).toEqual({
    start: { line: 2, column: 4 },
    end: { line: 5, column: 7 },
  });
  expect(block?.positionAt(0)).toEqual({ line: 3, column: 6 });
  const second = block!.code.indexOf("const b");
  expect(block?.positionAt(second)).toEqual({ line: 4, column: 7 });
});

test("a fence opened on the first line of a comment is offset by the comment start", () => {
  const source = "const x = 1; /** ```ts run\n * f();\n * ```\n */";
  const [block] = parseJsDocFences(source, "src/first.ts");
  expect(block?.details.range.start).toEqual({ line: 1, column: 18 });
  expect(block?.positionAt(0)).toEqual({ line: 2, column: 4 });
});
