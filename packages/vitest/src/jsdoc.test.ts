import { expect, test } from "vitest";
import { fixture } from "@ddtds/test-utils";
import { create, outcomes } from "./test-utils.ts";

const calc = {
  "package.json": '{ "name": "calc", "type": "module", "exports": "./src/math.ts" }',
  "src/math.ts": [
    "/**",
    " * ```ts run",
    ' * import { add } from "calc";',
    " * expect(add(1, 2)).toBe(3);",
    " * ```",
    " */",
    "export function add(a: number, b: number): number {",
    "  return a + b;",
    "}",
    "",
  ].join("\n"),
  "src/math.test.ts": [
    'import { expect, test } from "vitest";',
    'import { add } from "./math.ts";',
    'test("adds", () => expect(add(1, 1)).toBe(2));',
  ].join("\n"),
};

test("scans source files by default and not when the include is narrowed", async () => {
  await using dir = fixture(calc);
  const run = async (plugin: { include?: string[] }): Promise<string[]> => {
    await using instance = await create(dir.root, { plugin });
    await instance.start();
    return Object.keys(outcomes(instance.state.getTestModules())).toSorted();
  };

  expect(await run({})).toEqual(["adds", "src/math.ts:2"]);
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
