import { typedImports, type ModuleSystem, type TestAdapter } from "@ddtds/core";

const importFromNodeTest = typedImports<typeof import("node:test")>("node:test");
const importFromNodeAssert = typedImports<typeof import("node:assert")>("node:assert");

export function nodeTestAdapter(module: ModuleSystem): TestAdapter {
  return {
    runtime: "@ddtds/node-test/runtime",
    testImport: importFromNodeTest("test"),
    fenceImports: [importFromNodeAssert("strict", { alias: "assert", type: module })],
    module,
    forModule: nodeTestAdapter,
  };
}
