import { expect, test } from "vitest";
import { failures, fence, fixture, locations } from "./test-utils.ts";

const calc = {
  "package.json": '{ "name": "calc", "type": "module", "exports": "./src/index.ts" }',
  "src/index.ts": [
    "export function add(a: number, b: number): number {",
    "  return a - b;",
    "}",
    "",
    "export function divide(a: number, b: number): number {",
    '  if (b === 0) throw new RangeError("cannot divide by zero");',
    "  return a / b;",
    "}",
    "",
  ].join("\n"),
  "README.md": [
    "# Calc",
    "",
    fence('import { add } from "calc";\n\nconst sum = add(1, 2);\nexpect(sum).toBe(3);'),
    "Dividing by zero throws:",
    "",
    fence('import { divide } from "calc";\n\ndivide(1, 0);'),
  ].join("\n"),
};

test("failures point at the markdown line that failed", async () => {
  expect(await failures(fixture(calc))).toMatchInlineSnapshot(`
    {
      "README.md:13": {
        "diff": undefined,
        "error": "RangeError: cannot divide by zero",
        "frames": [
          "src/index.ts:6",
          "README.md:16",
        ],
      },
      "README.md:3": {
        "diff": "- Expected
    + Received

    - 3
    + -1",
        "error": "AssertionError: expected -1 to be 3 // Object.is equality",
        "frames": [
          "README.md:7",
        ],
      },
    }
  `);
});

test("editors place each test at its fence", async () => {
  expect(await locations(fixture(calc))).toMatchInlineSnapshot(`
    {
      "README.md:13": "13:1",
      "README.md:3": "3:1",
    }
  `);
});
