import { describe, expect, test } from "vitest";
import { emitFence } from "./emit.ts";
import { adapter, captureParseError, fence } from "./test-utils.ts";

const details = captureParseError(fence("const = 1;")).details;

const runtimeImport = "import { runtime } from '@ddtds/test/runtime';";

const COMPILE_ERROR_CALL = /^runtime\.compileError\(\(\{fileName:"\/repo\/docs\/t\.md",details:/;

describe("emitFence: run fences", () => {
  test("wraps the body in an async function after the adapter's fence imports", () => {
    expect(
      emitFence(
        adapter,
        {
          tag: "run",
          imports: ["import { a } from './a';"],
          importedNames: ["a"],
          body: ["a();"],
          shouldFail: false,
          syntax: "ambiguous",
        },
        "test.md:1",
      ),
    ).toEqual({
      imports: ["import { expect } from 'expect';", "import { a } from './a';"],
      tag: "block",
      open: "async () => {",
      body: ["  a();"],
      close: "}",
    });
  });

  test("a fail fence wraps the function in expectFailure and needs the runtime import", () => {
    expect(
      emitFence(
        adapter,
        {
          tag: "run",
          imports: [],
          importedNames: [],
          body: ["throw 1;"],
          shouldFail: true,
          syntax: "ambiguous",
        },
        "test.md:1",
      ),
    ).toEqual({
      imports: ["import { expect } from 'expect';", runtimeImport],
      tag: "block",
      open: "runtime.expectFailure({ run: async () => {",
      body: ["  throw 1;"],
      close: "} })",
    });
  });
});

describe("emitFence: injected imports", () => {
  test("a fence import of an injected name replaces the injected import", () => {
    expect(
      emitFence(
        adapter,
        {
          tag: "run",
          imports: ["import { expect } from 'my-expect';"],
          importedNames: ["expect"],
          body: [],
          shouldFail: false,
          syntax: "esm",
        },
        "test.md:1",
      ),
    ).toMatchObject({ imports: ["import { expect } from 'my-expect';"] });
  });
});

describe("emitFence: other outcomes", () => {
  test("an empty pass is a no-op function with no imports", () => {
    expect(emitFence(adapter, { tag: "emptyPass" }, "test.md:1")).toEqual({
      imports: [],
      tag: "inline",
      code: "async () => {}",
    });
  });

  test("a missing compile error calls the runtime helper with the fence position", () => {
    expect(
      emitFence(
        adapter,
        {
          tag: "missingCompileError",
          fileName: "/repo/docs/t.md",
          position: { line: 7, column: 1 },
        },
        "test.md:1",
      ),
    ).toEqual({
      imports: [runtimeImport],
      tag: "inline",
      code: 'runtime.missingCompileError(({fileName:"/repo/docs/t.md",position:{line:7,column:1}}))',
    });
  });

  test("a compile error passes its details and serialized cause to the runtime helper", () => {
    const code = emitFence(
      adapter,
      {
        tag: "compileError",
        fileName: "/repo/docs/t.md",
        details,
        cause: { name: "Error", message: "crashed", code: undefined },
      },
      "test.md:1",
    );
    expect(code.imports).toEqual([runtimeImport]);
    if (code.tag !== "inline") throw new Error("expected an inline runtime call");
    expect(code.code).toMatch(COMPILE_ERROR_CALL);
    expect(code.code).toContain('cause:{name:"Error",message:"crashed",code:void 0}');
  });
});
