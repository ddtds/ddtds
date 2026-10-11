import { expect, test } from "vitest";
import { coverage, failures, fence, fixture, locations } from "./test-utils.ts";

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
          "src/index.ts:6:22",
          "README.md:16:1",
        ],
      },
      "README.md:3": {
        "diff": "- Expected
    + Received

    - 3
    + -1",
        "error": "AssertionError: expected -1 to be 3 // Object.is equality",
        "frames": [
          "README.md:7:13",
        ],
      },
    }
  `);
});

test("fences indented in a list map to their columns", async () => {
  const guide = "1. Add:\n\n   ```ts run\n   const sum = 1 + 1;\n   expect(sum).toBe(3);\n   ```\n";
  const root = fixture({ "guide.md": guide });
  expect(await failures(root)).toMatchInlineSnapshot(`
    {
      "guide.md:3": {
        "diff": "- Expected
    + Received

    - 3
    + 2",
        "error": "AssertionError: expected 2 to be 3 // Object.is equality",
        "frames": [
          "guide.md:5:16",
        ],
      },
    }
  `);
  expect(await locations(root)).toMatchInlineSnapshot(`
    {
      "guide.md:3": "3:4",
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

test("coverage reports which markdown lines ran", async () => {
  const root = fixture({
    ...calc,
    "README.md": fence(
      'import { add } from "calc";\n\nconst sum = add(1, 2);\nif (sum > 100) {\n  throw new Error("too big");\n}',
    ),
  });
  const { "README.md": readme, ...sources } = await coverage(root);
  // Vitest 5 also counts the test() call, mapped to the fence's opening line; Vitest 4 does not
  expect(readme?.covered.filter((line) => line > 1)).toEqual([4, 5]);
  expect(readme?.uncovered).toEqual([6]);
  expect(sources).toMatchInlineSnapshot(`
    {
      "src/index.ts": {
        "covered": [
          2,
        ],
        "uncovered": [
          6,
          7,
        ],
      },
    }
  `);
});
