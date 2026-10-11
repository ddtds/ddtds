import { expect, test } from "vitest";
import { fixture, run } from "./test-utils.ts";

const math = [
  "/**",
  " * Adds two numbers.",
  " *",
  " * @example",
  " * ```ts run",
  ' * import { add } from "calc";',
  " * expect(add(1, 2)).toBe(3);",
  " * ```",
  " */",
  "export function add(a: number, b: number): number {",
  "  return a + b;",
  "}",
  "",
  "/**",
  " * @example",
  " * ```ts run",
  ' * import { subtract } from "calc";',
  " * expect(subtract(3, 1)).toBe(1);",
  " * ```",
  " */",
  "export function subtract(a: number, b: number): number {",
  "  return a - b;",
  "}",
  "",
].join("\n");

test("runs code fences in JSDoc comments as tests", async () => {
  const root = fixture({
    "package.json": '{ "name": "calc", "type": "module", "exports": "./src/math.ts" }',
    "src/math.ts": math,
    "src/math.test.ts": [
      'import { expect, test } from "vitest";',
      'import { add } from "./math.ts";',
      'test("adds", () => expect(add(1, 1)).toBe(2));',
    ].join("\n"),
  });
  expect(await run(root, { jsdoc: ["src/**/*.ts"] })).toMatchInlineSnapshot(`
    {
      "adds": "passed",
      "src/math.ts:16": "AssertionError",
      "src/math.ts:5": "passed",
    }
  `);
});
