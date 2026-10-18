import { expect, test } from "vitest";
import { typedImports } from "@ddtds/core";
import { defaultGlobals, vitestAdapter, vitestImports, vitestTestAdapter } from "./adapter.ts";

const names = (globals: readonly { locals: readonly string[] }[]): string[] =>
  globals.flatMap(({ locals }) => locals);

test("the default globals are expect and vi", () => {
  expect(names(defaultGlobals)).toEqual(["expect", "vi"]);
  expect(vitestTestAdapter.fenceImports).toBe(defaultGlobals);
});

test("an adapter injects exactly the globals it is given", () => {
  const custom = [
    ...defaultGlobals,
    vitestImports("describe"),
    typedImports<typeof import("node:path")>("node:path")("basename"),
  ];
  expect(names(vitestAdapter(custom).fenceImports)).toEqual([
    "expect",
    "vi",
    "describe",
    "basename",
  ]);
  expect(vitestAdapter([]).fenceImports).toEqual([]);
});

test("vitestImports renders an esm import of the vitest name", () => {
  expect(vitestImports("describe")).toEqual({
    statement: "import { describe } from 'vitest';",
    locals: ["describe"],
  });
});
