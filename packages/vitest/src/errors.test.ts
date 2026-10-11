import { expect, test } from "vitest";
import { failures, fence, fixture, run } from "./test-utils.ts";

test("classifies how doc tests fail", async () => {
  const root = fixture({
    "parse-error.md": fence("const = 1;"),
    "runtime-syntax-error.md": fence('JSON.parse("{");'),
    "undeclared-name.md": fence("missingFn();"),
    "missing-static-import.md": fence('import { x } from "./missing.ts";\nx;'),
    "missing-dynamic-import.md": fence('await import("./missing.ts");'),
    "failed-assertion.md": fence("expect(1).toBe(2);"),
    "passes.md": fence("expect(1).toBe(1);"),
  });
  expect(await run(root)).toMatchInlineSnapshot(`
    {
      "failed-assertion.md:1": "AssertionError",
      "missing-dynamic-import.md:1": "Error",
      "missing-static-import.md:1": "Error",
      "parse-error.md:1": "DdtCompileError",
      "passes.md:1": "passed",
      "runtime-syntax-error.md:1": "SyntaxError",
      "undeclared-name.md:1": "ReferenceError",
    }
  `);
});

test("a broken fence does not stop the rest of its doc", async () => {
  const root = fixture({
    "guide.md": fence('import { x } from "./missing.ts";\nx;') + fence("expect(1).toBe(1);"),
  });
  expect(await run(root)).toMatchInlineSnapshot(`
    {
      "guide.md:1": "Error",
      "guide.md:6": "passed",
    }
  `);
});

test("failures report the error the fence threw", async () => {
  const root = fixture({
    "guide.md": `# Guide\n\n${fence("const a = 1;\nexpect(a).toBe(2);")}${fence('throw new TypeError("boom");')}`,
  });
  expect(await failures(root)).toMatchInlineSnapshot(`
    {
      "guide.md:3": {
        "diff": "- Expected
    + Received

    - 2
    + 1",
        "error": "AssertionError: expected 1 to be 2 // Object.is equality",
        "frames": [
          "__ddtds__/guide_md_3.ts:4",
        ],
      },
      "guide.md:8": {
        "diff": undefined,
        "error": "TypeError: boom",
        "frames": [
          "__ddtds__/guide_md_8.ts:3",
        ],
      },
    }
  `);
});

test("no_run fences compile and load but never run", async () => {
  const root = fixture({
    "node_modules/calc/package.json": '{ "name": "calc", "type": "module", "main": "index.js" }',
    "node_modules/calc/index.js": "export const add = (a, b) => a + b;",
    "throws.md": fence('throw new Error("never runs");', "no_run"),
    "loops.md": fence("while (true) {}", "no_run"),
    "imports.md": fence('import { add } from "calc";\nadd(1, 2);', "no_run"),
    "missing-import.md": fence('import { x } from "missing-package";\nx;', "no_run"),
    "parse-error.md": fence("const = 1;", "no_run"),
  });
  expect(await run(root)).toMatchInlineSnapshot(`
    {
      "imports.md:1": "passed",
      "loops.md:1": "passed",
      "missing-import.md:1": "Error",
      "parse-error.md:1": "DdtCompileError",
      "throws.md:1": "passed",
    }
  `);
});
