import { expect, test } from "vitest";
import { fence, fixture, run } from "./test-utils.ts";

test("classifies how doc tests fail", async () => {
  const root = fixture({
    "parse-error.md": fence("const = 1;"),
    "runtime-syntax-error.md": fence('JSON.parse("{");'),
    "undeclared-name.md": fence("missingFn();"),
    "missing-static-import.md": fence('import { x } from "missing-package";\nx;'),
    "missing-dynamic-import.md": fence('await import("./missing.ts");'),
    "failed-assertion.md": fence("expect(1).toBe(2);"),
    "passes.md": fence("expect(1).toBe(1);"),
  });
  expect(await run(root)).toMatchInlineSnapshot(`
    {
      "failed-assertion.md:1": "runtime-failure",
      "missing-dynamic-import.md:1": "compile-error",
      "missing-static-import.md:1": "compile-error",
      "parse-error.md:1": "compile-error",
      "passes.md:1": "passed",
      "runtime-syntax-error.md:1": "runtime-failure",
      "undeclared-name.md:1": "compile-error",
    }
  `);
});

test("a broken fence does not stop the rest of its doc", async () => {
  const root = fixture({
    "guide.md": fence('import { x } from "./missing.ts";\nx;') + fence("expect(1).toBe(1);"),
  });
  expect(await run(root)).toMatchInlineSnapshot(`
    {
      "guide.md:1": "compile-error",
      "guide.md:6": "passed",
    }
  `);
});
