import { expect, test } from "vitest";
import { spawn } from "@ddtds/test-utils";
import { nodeTest } from "./e2e.ts";

test("only the file node starts with registers its JSDoc fences", async () => {
  const documented = [
    "/**",
    " * ```ts run",
    " * assert.equal(1, 1);",
    " * ```",
    " */",
    "export {};",
    "",
  ];
  await using ddt = spawn(
    nodeTest,
    {
      "entry.ts": 'import "./imported.ts";\n',
      "imported.ts": documented.join("\n"),
      "own.ts": documented.join("\n"),
    },
    { docs: ["entry.ts", "own.ts"] },
  );
  expect(await ddt.run()).toEqual({ "own.ts:2": "passed" });
});

test.each([
  ["a CommonJS package", { "package.json": '{"type":"commonjs"}', "own.ts": "own.ts" }],
  ["a .cts file", { "own.cts": "own.cts" }],
  ["a .cjs file", { "own.cjs": "own.cjs" }],
  ["a .mts file", { "own.mts": "own.mts" }],
])("%s registers its JSDoc fences", async (_, files) => {
  const documented = ["/**", " * ```ts run", " * assert.equal(1, 1);", " * ```", " */", "1;", ""];
  const own = Object.keys(files).find((name) => name.startsWith("own."))!;
  await using ddt = spawn(nodeTest, { ...files, [own]: documented.join("\n") }, { docs: [own] });
  expect(await ddt.run()).toEqual({ [`${own}:2`]: "passed" });
});

test("a failing fence in a .cts file fails its test", async () => {
  const source = ["/**", " * ```ts run", " * assert.equal(1, 2);", " * ```", " */", "1;", ""];
  await using ddt = spawn(nodeTest, { "own.cts": source.join("\n") }, { docs: ["own.cts"] });
  expect(await ddt.run()).toEqual({ "own.cts:2": "AssertionError ERR_ASSERTION" });
});

test("a file ending without a semicolon still registers its JSDoc fences", async () => {
  const source = [
    "/**",
    " * ```ts run",
    " * assert.equal(1, 1);",
    " * ```",
    " */",
    "console.log",
    "",
  ];
  await using ddt = spawn(nodeTest, { "own.ts": source.join("\n") }, { docs: ["own.ts"] });
  expect(await ddt.run()).toEqual({ "own.ts:2": "passed" });
});
