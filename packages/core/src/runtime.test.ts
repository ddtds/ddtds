import { describe, expect, test } from "vitest";
import { DdtCompileError, type CompileErrorDetails } from "./fences/compile-error.ts";
import { runtime } from "./runtime.ts";

const details: CompileErrorDetails = {
  block: {
    file: "t.md",
    lang: "ts",
    annotation: null,
    range: { start: { line: 1, column: 1 }, end: { line: 3, column: 4 } },
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
    const [broken, ok] = await runtime.loadFences([
      () => Promise.reject(error),
      async () => ({ default: noop }),
    ]);
    await expect(broken?.()).rejects.toBe(error);
    expect(ok).toBe(noop);
  });
});

describe("compileError", () => {
  test("rejects with the compile error", async () => {
    const error: unknown = await runtime
      .compileError({ fileName: "/docs/t.md", details })()
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(DdtCompileError);
    expect(error).toHaveProperty("cause", undefined);
  });

  test("keeps the cause when given", async () => {
    const cause = { name: "Error", message: "inner" };
    await expect(
      runtime.compileError({ fileName: "/docs/t.md", details, cause })(),
    ).rejects.toHaveProperty("cause", cause);
  });
});

test("missingCompileError points at the fence in the markdown", async () => {
  const run = runtime.missingCompileError({
    fileName: "/docs/t.md",
    position: { line: 3, column: 1 },
  });
  const error: unknown = await run().catch((caught: unknown) => caught);
  expect(error).toHaveProperty("message", "expected a compile_fail block to fail to compile");
  expect(error).toHaveProperty("stack", expect.stringContaining("at /docs/t.md:3:1"));
});

describe("runtime.expectFailure", () => {
  test("passes when the fence throws", async () => {
    await expect(
      runtime.expectFailure({ run: () => Promise.reject(new Error("boom")) })(),
    ).resolves.toBeUndefined();
  });

  test("fails when the fence does not throw", async () => {
    await expect(runtime.expectFailure({ run: noop })()).rejects.toThrow(
      "expected a fail block to throw",
    );
  });
});
