import { expect, test } from "vitest";
import {
  runtimeNames,
  staticImport,
  typedImports,
  unshadowed,
  type StaticImport,
} from "./static-import.ts";

const expectImport = staticImport("import { expect } from 'x';", "expect");
const testImport = staticImport("import { test } from 'x';", "test");

test("injected imports that bind a taken name are dropped", () => {
  expect(unshadowed([expectImport, testImport], ["expect"])).toEqual([testImport]);
});

test("nothing is dropped when no name is taken", () => {
  expect(unshadowed([expectImport, testImport], [])).toEqual([expectImport, testImport]);
});

test("typedImports records the local name, which is the alias when there is one", () => {
  const fromVitest = typedImports<typeof import("vitest")>("vitest");
  expect(fromVitest("test")).toEqual(staticImport("import { test } from 'vitest';", "test"));
  expect(fromVitest("test", { alias: "t" }).locals).toEqual(["t"]);
  expect(fromVitest("test", { type: "cjs" }).statement).toBe("const { test } = require('vitest');");
});

test("unshadowed keeps the order of the remaining imports", () => {
  const imports = ["a", "b", "c"].map((name) => staticImport(`import { ${name} } from 'x';`, name));
  expect(unshadowed(imports, ["b"]).map(({ locals }) => locals[0])).toEqual(["a", "c"]);
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
  const handWritten: StaticImport = { statement: "import { a } from 'a';", locals: ["a"] };
  expect(handWritten.locals).toEqual(["a"]);
});
