import { expect, test } from "vitest";
import { fence, fixture } from "@ddtds/test-utils";
import { coverage, failures, locations } from "./test-utils.ts";

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
  await using dir = fixture(calc);
  expect(await failures(dir.root)).toMatchInlineSnapshot(`
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
  await using dir = fixture({ "guide.md": guide });
  expect(await failures(dir.root)).toMatchInlineSnapshot(`
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
  expect(await locations(dir.root)).toMatchInlineSnapshot(`
    {
      "guide.md:3": "3:4",
    }
  `);
});

test("editors place each test at its fence", async () => {
  await using dir = fixture(calc);
  expect(await locations(dir.root)).toMatchInlineSnapshot(`
    {
      "README.md:13": "13:1",
      "README.md:3": "3:1",
    }
  `);
});

test("coverage maps fence statements to their markdown lines", async () => {
  await using dir = fixture({
    ...calc,
    "README.md": fence(
      'import { add } from "calc";\n\nconst sum = add(1, 2);\nif (sum > 100) {\n  throw new Error("too big");\n}',
    ),
  });
  const { "README.md": readme, ...sources } = await coverage(dir.root);
  expect(fenceCodeLines(readme?.covered)).toEqual([4, 5]);
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

function fenceCodeLines(lines: number[] | undefined) {
  return lines?.filter((line) => line > 1);
}
