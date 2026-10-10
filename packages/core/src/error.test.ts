import { describe, expect, test } from "vitest";
import { DdtCompileError } from "./compile-error";
import { DdtTestError, ErrorKind, wrapDdtTest } from "./error";

describe("DdtTestError", () => {
  test.each([
    "const x = ;",
    "import x from 'y'",
    "require('x')",
    "console.log(x)",
    "await import('x')",
    "window",
    "document",
    "React.createElement('div')",
    "new Foo()",
    "class X extends Y {}",
    "const = 10",
    "type Hi",
    "type X<T> = true; type Y = X<>",
  ])("rethrows as compile error: %s", async (fn) => {
    // eslint-disable-next-line no-eval
    const promise = wrapDdtTest(() => eval(fn));

    await expect(promise).rejects.toBeInstanceOf(DdtTestError);
    await expect(promise).rejects.toHaveProperty("kind", ErrorKind.Compile);
  });

  test.each([
    () => expect(1).toBe(2),
    () => {
      throw new Error("generic");
    },
    () => {
      // @ts-expect-error
      // eslint-disable-next-line no-unused-expressions
      null.y;
    },
  ])("rethrows as runtime error", async (fn) => {
    const promise = wrapDdtTest(fn);

    await expect(promise).rejects.toBeInstanceOf(DdtTestError);
    await expect(promise).rejects.toHaveProperty("kind", ErrorKind.RuntimeFailure);
  });

  test("rethrows DdtCompileError as compile error", async () => {
    const promise = wrapDdtTest(() => {
      throw new DdtCompileError({
        block: {
          file: "t.md",
          lang: "ts",
          meta: "run",
          annotation: "run",
          range: { start: { line: 1, column: 1 }, end: { line: 3, column: 4 } },
          indent: 0,
          contents: "",
        },
        parser: { name: "ts", package: "oxc-parser", version: "0.150.0" },
        phase: "parse",
        diagnostics: [],
      });
    });

    await expect(promise).rejects.toHaveProperty("kind", ErrorKind.Compile);
  });
});
