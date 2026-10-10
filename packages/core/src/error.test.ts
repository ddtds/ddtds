import { describe, expect, test } from "vitest";
import { DdtCompileError } from "./compile-error";
import { DdtTestError, ErrorKind, wrapDdtTest } from "./error";

describe("DdtTestError", () => {
  test.each([
    new SyntaxError("Cannot use import statement outside a module"),
    new Error("Cannot find module './x'"),
    new ReferenceError("x is not defined"),
  ])("rethrows as compile error: %s", async (error) => {
    const promise = wrapDdtTest(() => {
      throw error;
    });

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
    () => JSON.parse("{"),
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
          annotation: "run",
          range: { start: { line: 1, column: 1 }, end: { line: 3, column: 4 } },
          indent: 0,
          contents: "",
        },
        parser: { name: "ts", package: "oxc-parser", version: "0.0.0" },
        phase: "parse",
        diagnostics: [],
      });
    });

    await expect(promise).rejects.toHaveProperty("kind", ErrorKind.Compile);
  });
});
