import { describe, expect, test } from "vitest";
import { emitFence } from "./emit.ts";
import { adapter, captureParseError, fence } from "./test-utils.ts";

const details = captureParseError(fence("const = 1;")).details;

const runtimeImport = "import { runtime } from '@ddtds/test/runtime';";

describe("emitFence: run fences", () => {
  test("wraps the body in an async function after the adapter's fence imports", () => {
    expect(
      emitFence(adapter, {
        tag: "run",
        imports: ["import { a } from './a';"],
        body: "a();",
        shouldFail: false,
      }),
    ).toEqual({
      imports: ["import { expect } from 'expect';", "import { a } from './a';"],
      body: "async () => {\n  a();\n}",
    });
  });

  test("a fail fence wraps the function in expectFailure and needs the runtime import", () => {
    expect(
      emitFence(adapter, { tag: "run", imports: [], body: "throw 1;", shouldFail: true }),
    ).toEqual({
      imports: ["import { expect } from 'expect';", runtimeImport],
      body: "runtime.expectFailure({ run: async () => {\n  throw 1;\n} })",
    });
  });
});

describe("emitFence: other outcomes", () => {
  test("an empty pass is a no-op function with no imports", () => {
    expect(emitFence(adapter, { tag: "emptyPass" })).toEqual({
      imports: [],
      body: "async () => {}",
    });
  });

  test("a missing compile error calls the runtime helper with the fence position", () => {
    expect(
      emitFence(adapter, {
        tag: "missingCompileError",
        fileName: "/repo/docs/t.md",
        position: { line: 7, column: 1 },
      }),
    ).toEqual({
      imports: [runtimeImport],
      body: 'runtime.missingCompileError(({fileName:"/repo/docs/t.md",position:{line:7,column:1}}))',
    });
  });

  test("a compile error passes its details and serialized cause to the runtime helper", () => {
    const { imports, body } = emitFence(adapter, {
      tag: "compileError",
      fileName: "/repo/docs/t.md",
      details,
      cause: { name: "Error", message: "crashed", code: undefined },
    });
    expect(imports).toEqual([runtimeImport]);
    expect(body).toMatch(/^runtime\.compileError\(\(\{fileName:"\/repo\/docs\/t\.md",details:/);
    expect(body).toContain('cause:{name:"Error",message:"crashed",code:void 0}');
  });
});
