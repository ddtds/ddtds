import { expect, test } from "vitest";
import * as plugin from "@ddtds/node-test";
import * as runtime from "@ddtds/node-test/runtime";

test("the package root exposes the plugin and its config helpers", () => {
  expect(Object.keys(plugin).toSorted()).toEqual([
    "ddtHooks",
    "defaultGlobals",
    "nodeTestImports",
    "typedImports",
  ]);
});

test("the runtime exposes the shared runtime", () => {
  expect(Object.keys(runtime)).toEqual(["runtime"]);
});
