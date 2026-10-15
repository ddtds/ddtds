import { expect, test } from "vitest";
import { fence, spawn } from "@ddtds/test-utils";
import { nodeTest } from "./e2e.ts";

test("runs fences in markdown with node:test", async () => {
  await using ddt = spawn(nodeTest, {
    "guide.md": [
      "# Guide",
      "",
      fence("const sum: number = 1 + 1;\nassert.equal(sum, 2);"),
      fence("assert.equal(1 + 1, 3);"),
    ].join("\n"),
  });
  expect(await ddt.run()).toMatchInlineSnapshot(`
    {
      "guide.md:3": "passed",
      "guide.md:9": "AssertionError ERR_ASSERTION",
    }
  `);
});

test("imports packages from the project", async () => {
  await using ddt = spawn(nodeTest, {
    "node_modules/calc/package.json": '{ "name": "calc", "type": "module", "main": "index.js" }',
    "node_modules/calc/index.js": "export const add = (a, b) => a + b;",
    "README.md": fence('import { add } from "calc";\n\nassert.equal(add(1, 2), 3);'),
  });
  expect(await ddt.run()).toMatchInlineSnapshot(`
    {
      "README.md:1": "passed",
    }
  `);
});
