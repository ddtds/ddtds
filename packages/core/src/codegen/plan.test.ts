import { describe, expect, test } from "vitest";
import { ANNOTATIONS } from "../constants.ts";
import { planFence } from "./plan.ts";
import { failingWithCause, fence } from "./test-utils.ts";

describe("planFence: run fences", () => {
  test("reports the runtime names the fence imports bind, not type-only ones", () => {
    const outcome = planFence(
      fence('import a, { b as c, type D } from "x";\nimport * as ns from "y";\nimport "z";'),
    );
    if (outcome.tag !== "run") throw new Error("expected a run outcome");
    expect(outcome.importedNames).toEqual(["a", "c", "ns"]);
  });

  test("splits imports from the body", () => {
    const outcome = planFence(fence("import { a } from './a';\na();"));
    expect(outcome).toMatchObject({ tag: "run", shouldFail: false });
    if (outcome.tag !== "run") throw new Error("expected a run outcome");
    expect(outcome.imports.map(String)).toEqual(["import { a } from './a';"]);
    expect(outcome.body.map(String)).toEqual(["a();"]);
  });

  test("fail annotation marks the fence as expected to throw", () => {
    expect(planFence(fence("throw new Error();", ANNOTATIONS.FAIL))).toMatchObject({
      tag: "run",
      shouldFail: true,
    });
  });
});

describe("planFence: compile_fail fences", () => {
  test("code that compiles is missing its compile error, reported at the fence", () => {
    expect(planFence(fence("1;", ANNOTATIONS.COMPILE_FAIL, { line: 7 }))).toEqual({
      tag: "missingCompileError",
      fileName: "/repo/docs/t.md",
      position: { line: 7, column: 1 },
    });
  });

  test("a parse error is the expected failure", () => {
    expect(planFence(fence("const = 1;", ANNOTATIONS.COMPILE_FAIL))).toEqual({ tag: "emptyPass" });
  });
});

describe("planFence: compile errors", () => {
  test("a parse error in a run fence is a compile error with the parser's details", () => {
    const outcome = planFence(fence("const = 1;"));
    expect(outcome).toMatchObject({
      tag: "compileError",
      fileName: "/repo/docs/t.md",
      details: { phase: "parse" },
      cause: undefined,
    });
  });

  test("an Error cause becomes plain name, message, and code", () => {
    const cause = Object.assign(new TypeError("crashed"), { code: "E_CRASH" });
    const outcome = planFence(failingWithCause(fence("1;"), cause));
    expect(outcome).toMatchObject({
      tag: "compileError",
      cause: { name: "TypeError", message: "crashed", code: "E_CRASH" },
    });
    const plain = planFence(failingWithCause(fence("1;"), new Error("crashed")));
    expect(plain).toMatchObject({ cause: { name: "Error", message: "crashed", code: undefined } });
  });

  test("a non-Error cause is inspected so it serializes", () => {
    const outcome = planFence(failingWithCause(fence("1;"), "boom"));
    expect(outcome).toMatchObject({
      tag: "compileError",
      cause: { name: "UnknownCause", message: "'boom'" },
    });
  });

  test("errors that are not compile errors are rethrown", () => {
    const f = fence("1;");
    Object.assign(f.block, {
      splitImports: () => {
        throw new RangeError("not ours");
      },
    });
    expect(() => planFence(f)).toThrow(RangeError);
  });
});
