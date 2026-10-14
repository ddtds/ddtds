import { expect, test } from "vitest";
import { fence, spawn } from "@ddtds/test-utils";
import { fixture, runDocs } from "./test-utils.ts";
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
      "guide.md:9": "failed",
    }
  `);
});

test("classifies how doc tests fail", async () => {
  const root = fixture({
    "parse-error.md": fence("const = 1;"),
    "missing-import.md": fence('import { x } from "missing-package";\nx;'),
    "undeclared-name.md": fence("missingFn();"),
    "fail-annotation-throws.md": fence('throw new Error("boom");', "fail"),
    "fail-annotation-passes.md": fence("1;", "fail"),
    "compile-fail-compiles.md": fence("1;", "compile_fail"),
    "compile-fail-parse-error.md": fence("const = 1;", "compile_fail"),
  });
  const docs = [
    "parse-error.md",
    "missing-import.md",
    "undeclared-name.md",
    "fail-annotation-throws.md",
    "fail-annotation-passes.md",
    "compile-fail-compiles.md",
    "compile-fail-parse-error.md",
  ];
  expect(await runDocs(root, docs)).toMatchInlineSnapshot(`
    {
      "compile-fail-compiles.md:1": "Error",
      "compile-fail-parse-error.md:1": "passed",
      "fail-annotation-passes.md:1": "Error",
      "fail-annotation-throws.md:1": "passed",
      "missing-import.md:1": "Error ERR_MODULE_NOT_FOUND",
      "parse-error.md:1": "DdtCompileError",
      "undeclared-name.md:1": "ReferenceError",
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

test("reruns a doc when it is edited in watch mode", async () => {
  await using ddt = spawn(nodeTest, { "guide.md": fence("assert.equal(1, 1);") });
  expect(await ddt.watch()).toEqual({ "guide.md:1": "passed" });
  expect(await ddt.edit("guide.md", fence("assert.equal(1, 2);"))).toEqual({
    "guide.md:1": "failed",
  });
});
