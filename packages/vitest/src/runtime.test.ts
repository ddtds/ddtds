import { describe, expect, test } from "vitest";
import { DdtCompileError, type CompileErrorDetails } from "@ddtds/core";
import { compileError, expectFailure, loadFences, missingCompileError } from "./runtime.ts";

const details: CompileErrorDetails = {
  block: {
    file: "t.md",
    lang: "ts",
    annotation: null,
    range: { start: { line: 1, column: 1 }, end: { line: 3, column: 4 } },
    indent: 0,
    contents: "",
  },
  parser: { name: "ts", package: "oxc-parser", version: "0.0.0" },
  phase: "parse",
  diagnostics: [],
};

async function noop(): Promise<void> {}

describe("loadFences", () => {
  test("a fence that fails to load fails only its own run", async () => {
    const error = new Error("load failed");
    const [broken, ok] = await loadFences([
      () => Promise.reject(error),
      async () => ({ default: noop }),
    ]);
    await expect(broken?.()).rejects.toBe(error);
    expect(ok).toBe(noop);
  });
});

describe("expectFailure", () => {
  test("passes when the fence throws anything", async () => {
    await expect(expectFailure(() => Promise.reject(new Error("boom")))()).resolves.toBeUndefined();
  });

  test("fails when the fence does not throw", async () => {
    await expect(expectFailure(noop)()).rejects.toThrow("promise resolved");
  });
});

describe("compileError", () => {
  test("rejects with the compile error", async () => {
    const error: unknown = await compileError(details)().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(DdtCompileError);
    expect(error).not.toHaveProperty("cause");
  });

  test("keeps the cause when given", async () => {
    const cause = { name: "Error", message: "inner" };
    await expect(compileError(details, cause)()).rejects.toHaveProperty("cause", cause);
  });
});

test("missingCompileError explains what was expected", async () => {
  await expect(missingCompileError()()).rejects.toThrow(
    "expected a compile_fail block to fail to compile",
  );
});
