import { expect, test } from "vitest";
import { typedImports } from "@ddtds/core/imports";
import { defaultGlobals, vitestAdapter, vitestImports } from "./adapter.ts";

test("the default globals are expect and vi", () => {
  expect(defaultGlobals).toEqual([
    { module: "vitest", name: "expect" },
    { module: "vitest", name: "vi" },
  ]);
  expect(vitestAdapter(defaultGlobals).fenceImports).toBe(defaultGlobals);
});

test("an adapter injects exactly the globals it is given", () => {
  const custom = [
    ...defaultGlobals,
    vitestImports("describe"),
    typedImports<typeof import("node:path")>("node:path")("basename"),
  ];
  expect(vitestAdapter(custom).fenceImports).toEqual([
    { module: "vitest", name: "expect" },
    { module: "vitest", name: "vi" },
    { module: "vitest", name: "describe" },
    { module: "node:path", name: "basename" },
  ]);
  expect(vitestAdapter([]).fenceImports).toEqual([]);
});
