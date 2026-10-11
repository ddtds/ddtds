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
    "fail-annotation-passes.md": fence("1;", "fail"),
    "compile-fail-compiles.md": fence("1;", "compile_fail"),
    "passes.md": fence("expect(1).toBe(1);"),
  });
  expect(await run(root)).toMatchInlineSnapshot(`
    {
      "compile-fail-compiles.md:1": "Error",
      "fail-annotation-passes.md:1": "AssertionError",
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

test("compile failures point at the markdown", async () => {
  const root = fixture({
    "guide.md": `# Guide\n\n${fence("const ok = 1;\nconst = 1;")}${fence("1;", "compile_fail")}`,
  });
  expect(await failures(root)).toMatchInlineSnapshot(`
    {
      "guide.md:3": {
        "diff": undefined,
        "error": "DdtCompileError: guide.md:5:7 Unexpected token (ts block at line 3)",
        "frames": [
          "guide.md:5",
        ],
      },
      "guide.md:8": {
        "diff": undefined,
        "error": "Error: expected a compile_fail block to fail to compile",
        "frames": [
          "guide.md:8",
        ],
      },
    }
  `);
});

test("fences can use CommonJS", async () => {
  const root = fixture({
    "node_modules/calc/package.json": '{ "name": "calc", "main": "index.js" }',
    "node_modules/calc/index.js": "exports.add = (a, b) => a + b;",
    "docs/helper.cjs": "module.exports = { twice: (x) => x * 2 };",
    "docs/guide.md": [
      fence('const { add } = require("calc");\nexpect(add(1, 2)).toBe(3);'),
      fence('const { twice } = require("./helper.cjs");\nexpect(twice(2)).toBe(4);'),
      fence("exports.answer = 42;\nexpect(module.exports).toEqual({ answer: 42 });"),
      fence("const exports = 1;\nexpect(exports).toBe(1);"),
    ].join(""),
  });
  expect(await run(root)).toMatchInlineSnapshot(`
    {
      "docs/guide.md:1": "passed",
      "docs/guide.md:11": "passed",
      "docs/guide.md:16": "passed",
      "docs/guide.md:6": "passed",
    }
  `);
});

test("any text is valid markdown: an unclosed fence takes the rest of the doc as code", async () => {
  const root = fixture({
    "unclosed.md": "```ts run\nexpect(1).toBe(1);\n\n## Next section\n",
    "unclosed-html.md": "<div\n\n```ts run\nexpect(1).toBe(1);\n```\n",
  });
  expect(await run(root)).toMatchInlineSnapshot(`
    {
      "unclosed-html.md:3": "passed",
      "unclosed.md:1": "DdtCompileError",
    }
  `);
});

test("invalid MDX fails the run with the parser's error", async () => {
  const root = fixture({
    "broken.mdx": "# Guide\n\n<!-- TODO: explain -->\n\n```ts run\nexpect(1).toBe(1);\n```\n",
    "fine.md": fence("expect(1).toBe(1);"),
  });
  await expect(run(root)).rejects.toThrowErrorMatchingInlineSnapshot(
    `[Error: 3:1: Unexpected character \`!\` (U+0021) before name, expected a character that can start a name, such as a letter, \`$\`, or \`_\` (note: to create a comment in MDX, use \`{/* text */}\`) (mdx-jsx:unexpected-character)]`,
  );
});
