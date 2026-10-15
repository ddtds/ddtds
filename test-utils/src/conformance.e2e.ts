import { describe, expect, test } from "vitest";
import { fence, spawn, type Runner } from "./index.ts";

/** What a test framework has to say about itself; everything else is shared. */
export type Dialect = {
  /** An assertion that passes when `actual` equals `expected` */
  equal(actual: string, expected: string): string;
  /** The outcome of a fence whose assertion fails */
  assertion: string;
  /** The outcome of a fence that imports a package that is not installed */
  missingImport: string;
};

/**
 * Registers the end to end scenarios every framework has to pass.
 *
 * To cover a new framework, add three small pieces to its package:
 *   1. a reporter that prints `encode(outcomes)` once per run (see `packages/node-test/src/reporter.ts`)
 *   2. a `cli({ name, command })` runner that starts the framework in run or watch mode
 *   3. a `conformance.test.ts` calling this with a `Dialect`
 */
export function conformance(name: string, runner: Runner, dialect: Dialect): void {
  const passing = dialect.equal("1", "1");
  const failing = dialect.equal("1", "2");

  describe(`${name} conformance`, () => {
    test("reruns a doc when it is edited in watch mode", async () => {
      await using ddt = spawn(runner, { "guide.md": fence(passing) });
      expect(await ddt.watch()).toEqual({ "guide.md:1": "passed" });
      expect(await ddt.edit("guide.md", fence(failing))).toEqual({
        "guide.md:1": dialect.assertion,
      });
    });

    test("classifies how fences fail", async () => {
      await using ddt = spawn(runner, {
        "parse-error.md": fence("const = 1;"),
        "runtime-syntax-error.md": fence('JSON.parse("{");'),
        "undeclared-name.md": fence("missingFn();"),
        "missing-static-import.md": fence('import { x } from "missing-package";\nx;'),
        "missing-dynamic-import.md": fence('await import("missing-package");'),
        "failed-assertion.md": fence(failing),
        "fail-throws.md": fence('throw new Error("boom");', "fail"),
        "fail-passes.md": fence("1;", "fail"),
        "compile-fail-compiles.md": fence("1;", "compile_fail"),
        "compile-fail-parse-error.md": fence("const = 1;", "compile_fail"),
        "passes.md": fence(passing),
      });
      expect(await ddt.run()).toEqual({
        "parse-error.md:1": "DdtCompileError",
        "runtime-syntax-error.md:1": "SyntaxError",
        "undeclared-name.md:1": "ReferenceError",
        "missing-static-import.md:1": dialect.missingImport,
        "missing-dynamic-import.md:1": dialect.missingImport,
        "failed-assertion.md:1": dialect.assertion,
        "fail-throws.md:1": "passed",
        "fail-passes.md:1": "Error",
        "compile-fail-compiles.md:1": "Error",
        "compile-fail-parse-error.md:1": "passed",
        "passes.md:1": "passed",
      });
    });
  });
}
