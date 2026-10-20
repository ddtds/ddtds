import { expect, test } from "vitest";
import { typedImports, type StaticImport } from "./imports.ts";
import { localName, renderImport, runtimeNames, unshadowed } from "./static-import.ts";

const xImports = typedImports<Record<string, unknown>>("x");
const vitestImports = typedImports<typeof import("vitest")>("vitest");
const nodeAssertImports = typedImports<typeof import("node:assert")>("node:assert");

const expectImport = xImports("expect");
const testImport = xImports("test");

test("injected imports that bind a taken name are dropped", () => {
  expect(unshadowed([expectImport, testImport], ["expect"])).toEqual([testImport]);
});

test("nothing is dropped when no name is taken", () => {
  expect(unshadowed([expectImport, testImport], [])).toEqual([expectImport, testImport]);
});

test("typedImports records the module and name", () => {
  expect(vitestImports("test")).toEqual({ module: "vitest", name: "test" });
  expect(vitestImports("test", { alias: "t" })).toEqual({
    module: "vitest",
    name: "test",
    alias: "t",
  });
});

test("the local name is the alias when there is one", () => {
  expect(localName(vitestImports("test"))).toBe("test");
  expect(localName(vitestImports("test", { alias: "t" }))).toBe("t");
});

test.each([
  ["esm", "import { test } from 'vitest';"],
  ["cjs", "const { test } = require('vitest');"],
] as const)("renders for %s", (system, statement) => {
  expect(renderImport(vitestImports("test"), system)).toBe(statement);
});

test("renders an alias for each module system", () => {
  const strict = nodeAssertImports("strict", { alias: "assert" });
  expect(renderImport(strict, "esm")).toBe("import { strict as assert } from 'node:assert';");
  expect(renderImport(strict, "cjs")).toBe("const { strict: assert } = require('node:assert');");
});

test("unshadowed keeps the order of the remaining imports", () => {
  const imports = ["a", "b", "c"].map((name) => xImports(name));
  expect(unshadowed(imports, ["b"]).map(localName)).toEqual(["a", "c"]);
});

test("runtimeNames leaves out type-only bindings", () => {
  expect(
    runtimeNames([
      { local: "a", kind: "value" },
      { local: "B", kind: "type" },
    ]),
  ).toEqual(["a"]);
});

test("a hand-written object is not a StaticImport", () => {
  // @ts-expect-error only typedImports builds one for users
  const handWritten: StaticImport = { module: "a", name: "a" };
  expect(localName(handWritten)).toBe("a");
});
