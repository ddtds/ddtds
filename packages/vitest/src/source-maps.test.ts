import { assert, asyncProperty, integer, record } from "fast-check";
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

/**
 * A fence that runs `executed` statements and leaves `skipped` statements inside a
 * never-taken branch. Every statement sits on a known markdown line, so a test can
 * assert exactly which markdown lines a coverage report says ran.
 */
function generatedFence(executed: number, skipped: number, indent = 0) {
  const pad = " ".repeat(indent);
  const body = Array.from({ length: executed }, (_, i) => `${pad}const run${i} = ${i};`);
  // the fence opens on markdown line 1, so its first line of code is line 2
  const run = body.map((_, i) => i + 2);
  const condition = executed + 2;
  const skip = Array.from({ length: skipped }, (_, i) => condition + 1 + i);
  body.push(
    `${pad}if (false) {`,
    ...skip.map((_, i) => `${pad}  const skip${i} = ${i};`),
    `${pad}}`,
  );
  return { doc: fence(body.join("\n")), run, condition, skip };
}

/** Vitest 5 also counts the test() call, mapped to the fence's opening line; Vitest 4 does not */
function fenceLines(lines: number[] | undefined) {
  return lines?.filter((line) => line > 1);
}

const fenceShape = record({
  executed: integer({ min: 1, max: 4 }),
  skipped: integer({ min: 0, max: 3 }),
  indent: integer({ min: 0, max: 4 }),
});

// each run boots a real Vitest with v8 coverage, so keep the sample small
test("coverage maps every executed fence statement to its markdown line", async () => {
  await assert(
    asyncProperty(fenceShape, async ({ executed, skipped, indent }) => {
      const { doc, run, condition, skip } = generatedFence(executed, skipped, indent);
      const root = fixture({ "README.md": doc });
      const readme = (await coverage(root))["README.md"];

      // every executed statement is reported at its markdown line, and nothing else is
      expect(fenceLines(readme?.covered)).toEqual([...run, condition]);
      // the never-taken branch is reported as uncovered at its own markdown lines
      expect(fenceLines(readme?.uncovered)).toEqual(skip);
      // real coverage: the report actually saw the fence run
      expect(fenceLines(readme?.covered)).not.toEqual([]);
    }),
    { numRuns: 8 },
  );
});
