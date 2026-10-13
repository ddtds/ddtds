import { expect, test } from "vitest";
import { fence, fixture, run } from "./test-utils.ts";

const modules = {
  "docs/package.json": "{}",
  "docs/helper.cjs": "module.exports = { twice: (x) => x * 2 };",
  "docs/helper.js": "module.exports = { triple: (x) => x * 3 };",
  "docs/data.json": '{ "answer": 42 }',
  "node_modules/calc/package.json": '{ "name": "calc", "main": "index.js" }',
  "node_modules/calc/index.js": "exports.add = (a, b) => a + b;",
};

test("requires resolve like a file beside the doc", async () => {
  const root = fixture({
    ...modules,
    "docs/guide.md": [
      fence('expect(require("./data.json").answer).toBe(42);'),
      fence('expect(require("./helper.js").triple(2)).toBe(6);'),
      fence('const { add } = require("calc");\nexpect(add(1, 2)).toBe(3);'),
      fence('expect(require("node:path").basename("/a/b.txt")).toBe("b.txt");'),
      fence('expect(require.resolve("./helper.js")).toMatch(/helper\\.js$/);'),
    ].join(""),
  });
  expect(await run(root)).toMatchInlineSnapshot(`
    {
      "docs/guide.md:1": "passed",
      "docs/guide.md:14": "passed",
      "docs/guide.md:18": "passed",
      "docs/guide.md:5": "passed",
      "docs/guide.md:9": "passed",
    }
  `);
});

test("module and exports are the CommonJS pair", async () => {
  const root = fixture({
    "guide.md": [
      fence(
        "exports.a = 1;\nmodule.exports.b = 2;\nexpect(module.exports).toEqual({ a: 1, b: 2 });",
      ),
      fence(
        "module.exports = { replaced: true };\nexpect(module.exports).toEqual({ replaced: true });",
      ),
    ].join(""),
  });
  expect(await run(root)).toMatchInlineSnapshot(`
    {
      "guide.md:1": "passed",
      "guide.md:7": "passed",
    }
  `);
});

test("each fence gets its own module", async () => {
  const root = fixture({
    "guide.md": [
      fence("module.exports.leak = true;\nexpect(module.exports).toEqual({ leak: true });"),
      fence("expect(module.exports).toEqual({});"),
    ].join(""),
  });
  expect(await run(root)).toMatchInlineSnapshot(`
    {
      "guide.md:1": "passed",
      "guide.md:6": "passed",
    }
  `);
});

test("require works with static imports and in fail fences", async () => {
  const root = fixture({
    ...modules,
    "docs/guide.md": [
      fence(
        'import { basename } from "node:path";\nconst { twice } = require("./helper.cjs");\nexpect(basename("/a/b.txt")).toBe("b.txt");\nexpect(twice(2)).toBe(4);',
      ),
      fence('require("./missing.cjs");', "fail"),
    ].join(""),
  });
  expect(await run(root)).toMatchInlineSnapshot(`
    {
      "docs/guide.md:1": "passed",
      "docs/guide.md:8": "passed",
    }
  `);
});

test("the words require, module and exports do not break plain fences", async () => {
  const root = fixture({
    "guide.md": [
      fence('expect("module").toBe("module");'),
      fence("const require = (x: number): number => x;\nexpect(require(1)).toBe(1);"),
      fence("const exports = 1;\nexpect(exports).toBe(1);"),
    ].join(""),
  });
  expect(await run(root)).toMatchInlineSnapshot(`
    {
      "guide.md:1": "passed",
      "guide.md:10": "passed",
      "guide.md:5": "passed",
    }
  `);
});
