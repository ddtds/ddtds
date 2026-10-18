import { expect, test } from "vitest";
import {
  localName,
  renderImport,
  runtimeNames,
  staticImport,
  typedImports,
  unshadowed,
  type StaticImport,
} from "./static-import.ts";

const expectImport = staticImport("x", "expect");
const testImport = staticImport("x", "test");

test("injected imports that bind a taken name are dropped", () => {
  expect(unshadowed([expectImport, testImport], ["expect"])).toEqual([testImport]);
});

test("nothing is dropped when no name is taken", () => {
  expect(unshadowed([expectImport, testImport], [])).toEqual([expectImport, testImport]);
});

test("typedImports records the module and name", () => {
  const fromVitest = typedImports<typeof import("vitest")>("vitest");
  expect(fromVitest("test")).toEqual(staticImport("vitest", "test"));
  expect(fromVitest("test", { alias: "t" })).toEqual(staticImport("vitest", "test", "t"));
});

test("the local name is the alias when there is one", () => {
  expect(localName(staticImport("vitest", "test"))).toBe("test");
  expect(localName(staticImport("vitest", "test", "t"))).toBe("t");
});

test.each([
  ["esm", "import { test } from 'vitest';"],
  ["cjs", "const { test } = require('vitest');"],
] as const)("renders for %s", (system, statement) => {
  expect(renderImport(staticImport("vitest", "test"), system)).toBe(statement);
});

test("renders an alias for each module system", () => {
  const strict = staticImport("node:assert", "strict", "assert");
  expect(renderImport(strict, "esm")).toBe("import { strict as assert } from 'node:assert';");
  expect(renderImport(strict, "cjs")).toBe("const { strict: assert } = require('node:assert');");
});

test("unshadowed keeps the order of the remaining imports", () => {
  const imports = ["a", "b", "c"].map((name) => staticImport("x", name));
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
