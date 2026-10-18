import { typedImports, type ModuleSystem, type StaticImport, type TestAdapter } from "@ddtds/core";

export const nodeTestImports: ReturnType<typeof typedImports<typeof import("node:test")>> =
  typedImports("node:test");

export const nodeAssertImports: ReturnType<typeof typedImports<typeof import("node:assert")>> =
  typedImports("node:assert");

export const defaultGlobals: readonly StaticImport[] = [
  nodeAssertImports("strict", { alias: "assert" }),
  nodeTestImports("mock"),
];

export function nodeTestAdapter(
  module: ModuleSystem,
  globals: readonly StaticImport[] = defaultGlobals,
): TestAdapter {
  return {
    runtime: "@ddtds/node-test/runtime",
    testImport: nodeTestImports("test"),
    fenceImports: globals,
    module,
    forModule: (forModule) => nodeTestAdapter(forModule, globals),
  };
}
