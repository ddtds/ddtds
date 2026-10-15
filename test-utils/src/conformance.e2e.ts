/* tests common properties of test frameworks
 * for example, watch mode should rerun when a
 * fence is modified
 */

import { describe, expect, test } from "vitest";
import { fence, spawn, type Outcomes, type Runner } from "./index.ts";

export type Dialect = {
  /** An assertion that passes when `actual` equals `expected` */
  equal(actual: string, expected: string): string;
  /** The outcome of a fence whose assertion fails */
  assertion: string;
  /** The outcome of a fence that imports a package that is not installed */
  missingImport: string;
};

const missingPackage = 'import { x } from "missing-package";\nx;';

export function conformance(name: string, runner: Runner, dialect: Dialect): void {
  const { assertion, missingImport } = dialect;
  const passing = dialect.equal("1", "1");
  const failing = dialect.equal("1", "2");

  const docs: [title: string, doc: string, expected: Outcomes][] = [
    ["a passing fence", fence(passing), { "doc.md:1": "passed" }],
    ["a failing assertion", fence(failing), { "doc.md:1": assertion }],
    [
      "passing and failing fences under a heading",
      `# Guide\n\n${fence(`const sum: number = 1 + 1;\n${dialect.equal("sum", "2")}`)}${fence(failing)}`,
      { "doc.md:3": "passed", "doc.md:8": assertion },
    ],
    ["a syntax error", fence("const = 1;"), { "doc.md:1": "DdtCompileError" }],
    ["a syntax error at runtime", fence('JSON.parse("{");'), { "doc.md:1": "SyntaxError" }],
    ["an undeclared name", fence("missingFn();"), { "doc.md:1": "ReferenceError" }],
    ["a missing static import", fence(missingPackage), { "doc.md:1": missingImport }],
    [
      "a missing dynamic import",
      fence('await import("missing-package");'),
      { "doc.md:1": missingImport },
    ],
    [
      "a broken fence next to a passing one",
      fence(missingPackage) + fence(passing),
      { "doc.md:1": missingImport, "doc.md:6": "passed" },
    ],
    [
      "a fail fence that throws",
      fence('throw new Error("boom");', "fail"),
      { "doc.md:1": "passed" },
    ],
    ["a fail fence that passes", fence("1;", "fail"), { "doc.md:1": "Error" }],
    ["a compile_fail fence that compiles", fence("1;", "compile_fail"), { "doc.md:1": "Error" }],
    [
      "a compile_fail fence that does not compile",
      fence("const = 1;", "compile_fail"),
      { "doc.md:1": "passed" },
    ],
    [
      "an unclosed fence, which takes the rest of the doc as code",
      `\`\`\`ts run\n${passing}\n\n## Next section\n`,
      { "doc.md:1": "DdtCompileError" },
    ],
    [
      "a fence after an unclosed html tag",
      `<div\n\n\`\`\`ts run\n${passing}\n\`\`\`\n`,
      { "doc.md:3": "passed" },
    ],
  ];

  describe(`${name} conformance`, () => {
    test.each(docs)("runs %s", async (_title, doc, expected) => {
      await using ddt = spawn(runner, { "doc.md": doc });
      expect(await ddt.run()).toEqual(expected);
    });

    test("imports packages from the project", async () => {
      await using ddt = spawn(runner, {
        "node_modules/calc/package.json":
          '{ "name": "calc", "type": "module", "main": "index.js" }',
        "node_modules/calc/index.js": "export const add = (a, b) => a + b;",
        "README.md": fence(`import { add } from "calc";\n\n${dialect.equal("add(1, 2)", "3")}`),
      });
      expect(await ddt.run()).toEqual({ "README.md:1": "passed" });
    });

    test("reruns a doc each time it is edited in watch mode", async () => {
      await using ddt = spawn(runner, { "guide.md": fence(passing) });
      expect(await ddt.watch()).toEqual({ "guide.md:1": "passed" });
      expect(await ddt.edit("guide.md", fence(failing))).toEqual({ "guide.md:1": assertion });
      expect(await ddt.edit("guide.md", fence(passing))).toEqual({ "guide.md:1": "passed" });
    });
  });
}
