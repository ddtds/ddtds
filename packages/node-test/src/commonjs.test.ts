import { expect, test } from "vitest";
import { fence, spawn } from "@ddtds/test-utils";
import { nodeTest } from "./e2e.ts";

const commonjs = {
  "package.json": '{ "type": "commonjs" }',
  "node_modules/calc/package.json": '{ "name": "calc", "main": "index.js" }',
  "node_modules/calc/index.js": "module.exports = { add: (a, b) => a + b };",
};

test("a CommonJS package's fences use require", async () => {
  await using ddt = spawn(nodeTest, {
    ...commonjs,
    "guide.md": fence('const { add } = require("calc");\nassert.equal(add(1, 2), 3);', "run", "js"),
  });
  expect(await ddt.run()).toEqual({ "guide.md:1": "passed" });
});

test("a CommonJS package's fences can be TypeScript", async () => {
  await using ddt = spawn(nodeTest, {
    ...commonjs,
    "guide.md": fence(
      'const { add } = require("calc");\nconst sum: number = add(1, 2);\nassert.equal(sum, 3);',
    ),
  });
  expect(await ddt.run()).toEqual({ "guide.md:1": "passed" });
});

test("a CommonJS package's fail and compile_fail fences keep their meaning", async () => {
  await using ddt = spawn(nodeTest, {
    ...commonjs,
    "guide.md": [
      fence("assert.equal(1, 2);", "fail", "js"),
      fence("const = ;", "compile_fail", "js"),
      fence("assert.equal(1, 2);", "run", "js"),
    ].join(""),
  });
  expect(await ddt.run()).toEqual({
    "guide.md:1": "passed",
    "guide.md:5": "passed",
    "guide.md:9": "AssertionError ERR_ASSERTION",
  });
});

test("a CommonJS package reruns a doc when it is edited in watch mode", async () => {
  await using ddt = spawn(nodeTest, {
    ...commonjs,
    "guide.md": fence("assert.equal(1, 1);", "run", "js"),
  });
  expect(await ddt.watch()).toEqual({ "guide.md:1": "passed" });
  expect(await ddt.edit("guide.md", fence("assert.equal(1, 2);", "run", "js"))).toEqual({
    "guide.md:1": "AssertionError ERR_ASSERTION",
  });
});
