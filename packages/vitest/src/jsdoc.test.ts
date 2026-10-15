import { expect, test } from "vitest";
import { fixture } from "@ddtds/test-utils";
import { create, failures, outcomes } from "./test-utils.ts";

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

const calc = {
  "package.json": '{ "name": "calc", "type": "module", "exports": "./src/math.ts" }',
  "src/math.ts": math,
  "src/math.test.ts": [
    'import { expect, test } from "vitest";',
    'import { add } from "./math.ts";',
    'test("adds", () => expect(add(1, 1)).toBe(2));',
  ].join("\n"),
};

test("runs code fences in JSDoc comments as tests", async () => {
  await using dir = fixture(calc);
  await using instance = await create(dir.root, { plugin: { include: ["src/**/*.ts"] } });
  await instance.start();
  expect(outcomes(instance.state.getTestModules())).toMatchInlineSnapshot(`
    {
      "adds": "passed",
      "src/math.ts:16": "AssertionError",
      "src/math.ts:5": "passed",
    }
  `);
});

test("failures point at the source file line that failed", async () => {
  await using dir = fixture(calc);
  expect(await failures(dir.root, { include: ["src/**/*.ts"] })).toMatchInlineSnapshot(`
    {
      "src/math.ts:16": {
        "diff": "- Expected
    + Received

    - 1
    + 2",
        "error": "AssertionError: expected 2 to be 1 // Object.is equality",
        "frames": [
          "src/math.ts:18:27",
        ],
      },
    }
  `);
});

test("scans source files by default and not when the include is narrowed", async () => {
  await using dir = fixture(calc);
  const run = async (plugin: { include?: string[] }): Promise<string[]> => {
    await using instance = await create(dir.root, { plugin });
    await instance.start();
    return Object.keys(outcomes(instance.state.getTestModules())).toSorted();
  };

  expect(await run({})).toEqual(["adds", "src/math.ts:16", "src/math.ts:5"]);
  expect(await run({ include: ["README.md"] })).toEqual(["adds"]);
});

test("leaves in-source tests the user did not enable alone", async () => {
  const inline = [
    "if (import.meta.vitest) {",
    '  import.meta.vitest.test("inline", () => {});',
    "}",
    "",
  ].join("\n");
  await using dir = fixture({ ...calc, "src/inline.ts": inline });
  await using instance = await create(dir.root);
  await instance.start();
  expect(Object.keys(outcomes(instance.state.getTestModules()))).not.toContain("inline");
});
