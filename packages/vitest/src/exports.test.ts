import { expect, test } from "vitest";
import * as adapter from "@ddtds/vitest/adapter";
import * as plugin from "@ddtds/vitest";
import * as runtime from "@ddtds/vitest/runtime";

test("the package root exposes the plugin and its config helpers", () => {
  expect(Object.keys(plugin).toSorted()).toEqual([
    "ddtPlugin",
    "defaultDocsExclude",
    "defaultDocsInclude",
    "defaultGlobals",
    "typedImports",
    "vitestImports",
  ]);
});

test("the adapter exposes only what the plugin builds with", () => {
  expect(Object.keys(adapter).toSorted()).toEqual([
    "defaultGlobals",
    "vitestAdapter",
    "vitestImports",
  ]);
});

test("the runtime exposes the shared runtime", () => {
  expect(Object.keys(runtime)).toEqual(["runtime"]);
});
