import { expect, test } from "vitest";
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

test("the runtime exposes the shared runtime", () => {
  expect(Object.keys(runtime)).toEqual(["runtime"]);
});
