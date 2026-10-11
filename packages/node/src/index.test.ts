import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { fence, fixture, reportDocs, runDocs, watchDocs } from "./test-utils.ts";

test("runs fences in markdown with node:test", async () => {
  const root = fixture({
    "guide.md": [
      "# Guide",
      "",
      fence("const sum: number = 1 + 1;\nassert.equal(sum, 2);"),
      fence("assert.equal(1 + 1, 3);"),
    ].join("\n"),
  });
  expect(await runDocs(root, ["guide.md"])).toMatchInlineSnapshot(`
    {
      "guide.md:3": "passed",
      "guide.md:9": "AssertionError ERR_ASSERTION",
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
      "fail-annotation-passes.md:1": "AssertionError ERR_ASSERTION",
      "fail-annotation-throws.md:1": "passed",
      "missing-import.md:1": "Error ERR_MODULE_NOT_FOUND",
      "parse-error.md:1": "DdtCompileError",
      "undeclared-name.md:1": "ReferenceError",
    }
  `);
});

test("imports packages from the project", async () => {
  const root = fixture({
    "node_modules/calc/package.json": '{ "name": "calc", "type": "module", "main": "index.js" }',
    "node_modules/calc/index.js": "export const add = (a, b) => a + b;",
    "README.md": fence('import { add } from "calc";\n\nassert.equal(add(1, 2), 3);'),
  });
  expect(await runDocs(root, ["README.md"])).toMatchInlineSnapshot(`
    {
      "README.md:1": "passed",
    }
  `);
});

test("reruns a doc when it is edited in watch mode", async () => {
  const root = fixture({ "guide.md": fence("assert.equal(1, 1);") });
  const edit = () => writeFileSync(join(root, "guide.md"), fence("assert.equal(1, 2);"));
  expect(await watchDocs(root, "guide.md", edit)).toMatchInlineSnapshot(`
    [
      {
        "guide.md:1": "passed",
      },
      {
        "guide.md:1": "failed",
      },
    ]
  `);
});

test("failures and test locations point at the markdown", async () => {
  const root = fixture({
    "node_modules/calc/package.json": '{ "name": "calc", "type": "module", "main": "index.js" }',
    "node_modules/calc/index.js": "export const add = (a, b) => a - b;",
    "README.md": [
      "# Calc",
      "",
      fence('import { add } from "calc";\n\nconst sum: number = add(1, 2);\nassert.equal(sum, 3);'),
      "1. In a list:",
      "",
      "   ```ts run",
      "   assert.equal(1 + 1, 2);",
      "   ```",
      "",
    ].join("\n"),
  });
  expect(await reportDocs(root, ["README.md"])).toMatchInlineSnapshot(`
    {
      "README.md:13": {
        "location": "README.md:13:4",
      },
      "README.md:3": {
        "frames": [
          "README.md:7:8",
        ],
        "location": "README.md:3:1",
      },
    }
  `);
});

test("fences can use CommonJS", async () => {
  const root = fixture({
    "node_modules/calc/package.json": '{ "name": "calc", "main": "index.js" }',
    "node_modules/calc/index.js": "exports.add = (a, b) => a + b;",
    "guide.md": fence('const { add } = require("calc");\nassert.equal(add(1, 2), 3);'),
  });
  expect(await runDocs(root, ["guide.md"])).toMatchInlineSnapshot(`
    {
      "guide.md:1": "passed",
    }
  `);
});
