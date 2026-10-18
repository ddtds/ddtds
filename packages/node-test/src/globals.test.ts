import { join } from "node:path";
import { expect, test } from "vitest";
import { cli, fence, spawn } from "@ddtds/test-utils";

const index = join(import.meta.dirname, "index.ts");
const reporter = join(import.meta.dirname, "reporter.ts");

const withGlobals = cli({
  name: "node:test with custom globals",
  command: (docs) => [
    process.execPath,
    "--test",
    `--test-reporter=${reporter}`,
    "--import",
    "./register.ts",
    ...docs,
  ],
});

function register(module: string, globals: string): string {
  return [
    `import { registerHooks } from "node:module";`,
    `import { ddtHooks, defaultGlobals, nodeTestImports } from ${JSON.stringify(index)};`,
    `registerHooks(ddtHooks(process.cwd(), { module: ${JSON.stringify(module)}, globals: ${globals} }));`,
  ].join("\n");
}

test.each(["esm", "cjs"])("%s fences get assert and mock by default", async (module) => {
  await using ddt = spawn(
    withGlobals,
    {
      "register.ts": register(module, "defaultGlobals"),
      "doc.md": fence("assert.equal(typeof mock.fn, 'function');"),
    },
    { docs: ["doc.md"] },
  );
  expect(await ddt.run()).toEqual({ "doc.md:1": "passed" });
});

test.each(["esm", "cjs"])("%s fences get the globals they are given", async (module) => {
  await using ddt = spawn(
    withGlobals,
    {
      "register.ts": register(module, `[...defaultGlobals, nodeTestImports("describe")]`),
      "doc.md": fence("assert.equal(typeof describe, 'function');"),
    },
    { docs: ["doc.md"] },
  );
  expect(await ddt.run()).toEqual({ "doc.md:1": "passed" });
});

test.each(["esm", "cjs"])("%s fences get nothing from an empty globals array", async (module) => {
  await using ddt = spawn(
    withGlobals,
    {
      "register.ts": register(module, "[]"),
      "doc.md": fence(
        "if (typeof assert !== 'undefined' || typeof mock !== 'undefined') throw new Error('injected');",
      ),
    },
    { docs: ["doc.md"] },
  );
  expect(await ddt.run()).toEqual({ "doc.md:1": "passed" });
});
