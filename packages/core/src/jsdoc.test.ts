import { describe, expect, test } from "vitest";
import type { Position } from "./compile-error.ts";
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
  expect(blocks.map(({ details: { range, contents } }) => ({ range, contents })))
    .toMatchInlineSnapshot(`
      [
        {
          "contents": "const counter = new Counter();",
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

/** The character in `source` at a 1 indexed position */
function charAt(source: string, { line, column }: Position): string {
  const text = source.split("\n")[line - 1] ?? "";
  return text[column - 1] ?? "";
}

/** The fence count, and each code character whose reported position is not that character in the file */
function mapping(source: string): { fences: number; mismatches: string[] } {
  const blocks = parseJsDocFences(source, "src/edge.ts");
  const mismatches: string[] = [];
  for (const block of blocks) {
    for (let offset = 0; offset < block.code.length; offset++) {
      const char = block.code.charAt(offset);
      if (char === "\n" || char === "\r") continue;
      const position = block.positionAt(offset);
      const found = charAt(source, position);
      if (found !== char) {
        mismatches.push(
          `${JSON.stringify(char)} at ${position.line}:${position.column} is ${JSON.stringify(found)}`,
        );
      }
    }
  }
  return { fences: blocks.length, mismatches };
}

const cases: Record<string, string[]> = {
  "plain comment": ["/**", " * ```ts run", " * const a = 1;", " * ```", " */"],
  "indented class member": [
    "class A {",
    "  /**",
    "   * ```ts run",
    "   * const a = 1;",
    "   *   const b = 2;",
    "   * ```",
    "   */",
    "  m() {}",
    "}",
  ],
  tabs: ["\t/**", "\t * ```ts run", "\t * const a = 1;", "\t * ```", "\t */"],
  "tab after the star": ["/**", " *\t```ts run", " *\tconst a = 1;", " *\t```", " */"],
  "mixed tabs and spaces": ["\t /**", " \t * ```ts run", "\t\t* const a = 1;", " \t * ```", " */"],
  "no star prefix": ["/**", "```ts run", "const a = 1;", "```", " */"],
  "no space after the star": ["/**", " *```ts run", " *const a = 1;", " *```", " */"],
  "ragged prefixes": [
    "/**",
    " * ```ts run",
    "     * const a = 1;",
    " *   const b = 2;",
    "*const c = 3;",
    " * ```",
    " */",
  ],
  "fence on the opening line": ["/** ```ts run", " * const a = 1;", " * ```", " */"],
  "fence after code on the opening line": [
    "export const x = 1; /** ```ts run",
    " * const a = 1;",
    " * ```",
    " */",
  ],
  "closing fence on the closing line": ["/**", " * ```ts run", " * const a = 1;", " * ``` */"],
  "indented fence in a list": [
    "/**",
    " * - item",
    " *",
    " *   ```ts run",
    " *   const a = 1;",
    " *     const b = 2;",
    " *   ```",
    " */",
  ],
  "tilde fence": ["/**", " * ~~~ts run", " * const a = 1;", " * ~~~", " */"],
  "blank lines in the fence": [
    "/**",
    " * ```ts run",
    " * const a = 1;",
    " *",
    " * const b = 2;",
    " * ```",
    " */",
  ],
  "non ASCII before the comment": [
    "const café = 'ñ'; /** ```ts run",
    " * const a = 'é';",
    " * ```",
    " */",
  ],
  "astral characters": [
    "const smile = '😀'; /** ```ts run",
    " * const a = '😀' + 1;",
    " * ```",
    " */",
  ],
  "non ASCII in the prefix": ["/**", "　* ```ts run", "　* const a = 1;", "　* ```", " */"],
  "multiple comments": [
    "/**",
    " * ```ts run",
    " * const a = 1;",
    " * ```",
    " */",
    "export const a = 1;",
    "",
    "    /**",
    "     * ```ts run",
    "     * const b = 2;",
    "     * ```",
    "     */",
    "export const b = 2;",
  ],
  "several fences in one comment": [
    "  /**",
    "   * ```ts run",
    "   * const a = 1;",
    "   * ```",
    "   *",
    "   * ```ts run",
    "   * const b = 2;",
    "   * ```",
    "   */",
  ],
};

const fencesIn: Record<string, number> = {
  "multiple comments": 2,
  "several fences in one comment": 2,
};

describe("positions map back to the same character in the file", () => {
  test.each(Object.entries(cases))("%s", (name, lines) => {
    expect(mapping(lines.join("\n"))).toEqual({ fences: fencesIn[name] ?? 1, mismatches: [] });
  });

  test.each(Object.entries(cases))("%s with CRLF line endings", (name, lines) => {
    expect(mapping(lines.join("\r\n"))).toEqual({ fences: fencesIn[name] ?? 1, mismatches: [] });
  });
});

test("comments without fences, or with only unclosed fences, yield nothing", () => {
  expect(parseJsDocFences("/** just text */\nconst a = 1;", "a.ts")).toEqual([]);
  expect(parseJsDocFences("/**\n * ```ts run\n * const a = 1;\n */", "a.ts")).toHaveLength(1);
});

describe("what is not a JSDoc fence", () => {
  const fence = "/**\n * ```ts run\n * const a = 1;\n * ```\n */\n";

  test("comment-like text inside strings and templates", () => {
    expect(parseJsDocFences(`const s = ${JSON.stringify(fence)};`, "a.ts")).toEqual([]);
    expect(parseJsDocFences(`const s = \`\n${fence}\`;`, "a.ts")).toEqual([]);
  });

  test("a skipped fence", () => {
    expect(parseJsDocFences(fence.replace("run", "skip"), "a.ts")).toEqual([]);
  });

  test("an unterminated comment", () => {
    expect(parseJsDocFences(fence.replace(" */\n", ""), "a.ts")).toEqual([]);
  });
});

describe("files that are not plain TypeScript", () => {
  const fence = "/**\n * ```ts run\n * const a = 1;\n * ```\n */\n";

  test.each([
    ["a hashbang", `#!/usr/bin/env node\n${fence}`],
    ["a byte order mark", `\uFEFF${fence}`],
    ["a syntax error after the comment", `${fence}const = = ;;{{{`],
  ])("finds the fence with %s", (_, source) => {
    expect(parseJsDocFences(source, "a.ts").map(({ code }) => code)).toEqual(["const a = 1;"]);
  });
});
