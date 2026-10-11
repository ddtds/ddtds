import { expect, test } from "vitest";
import { failures, fence, fixture, run } from "./test-utils.ts";

const calc = {
  "node_modules/calc/package.json": '{ "name": "calc", "type": "module", "main": "index.js" }',
  "node_modules/calc/index.js": "export const add = (a, b) => a + b;",
};

test("a ddt comment before a fence runs hidden setup for it", async () => {
  const root = fixture({
    ...calc,
    "guide.md": [
      "# Guide",
      "",
      "<!-- ddt",
      'import { add } from "calc";',
      "const total = add(1, 2);",
      "-->",
      "",
      fence("expect(total).toBe(3);"),
      fence("expect(typeof total).toBe('undefined');"),
      "<!-- a comment for readers -->",
      "",
      fence("expect(1).toBe(1);"),
    ].join("\n"),
  });
  expect(await run(root)).toMatchInlineSnapshot(`
    {
      "guide.md:13": "passed",
      "guide.md:20": "passed",
      "guide.md:8": "passed",
    }
  `);
});

test("errors in hidden setup fail the fence, pointing at the comment", async () => {
  const root = fixture({
    "guide.md": [
      "<!-- ddt",
      "const value = 1;",
      'throw new Error("setup failed");',
      "-->",
      "",
      fence("expect(value).toBe(1);"),
      "<!-- ddt",
      "const = 1;",
      "-->",
      fence("1;"),
    ].join("\n"),
  });
  const errors = Object.entries(await failures(root))
    .map(([name, { error }]) => `${name} ${error}`)
    .toSorted();
  expect(errors).toMatchInlineSnapshot(`
    [
      "guide.md:14 DdtCompileError: guide.md:12:7 Unexpected token (ts block at line 14)",
      "guide.md:6 Error: setup failed",
    ]
  `);
});

test("MDX docs hold hidden setup in a ddt expression comment", async () => {
  const root = fixture({
    ...calc,
    "guide.mdx": [
      "{/* ddt",
      'import { add } from "calc";',
      "const total = add(1, 2);",
      "*/}",
      "",
      fence("expect(total).toBe(3);"),
      "<Steps>",
      "  {/* ddt",
      "  const one = 1;",
      "  */}",
      "",
      "  ```ts run",
      "  expect(one).toBe(1);",
      "  ```",
      "</Steps>",
      "",
      "{/* a comment for readers */}",
      "",
      fence("expect(typeof total).toBe('undefined');"),
    ].join("\n"),
  });
  expect(await run(root)).toMatchInlineSnapshot(`
    {
      "guide.mdx:16": "passed",
      "guide.mdx:23": "passed",
      "guide.mdx:6": "passed",
    }
  `);
});
