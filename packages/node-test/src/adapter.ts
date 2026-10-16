import { typedImports, type ModuleSystem, type TestAdapter } from "@ddtds/core";

const importFromNodeTest = typedImports<typeof import("node:test")>("node:test");
const importFromNodeAssert = typedImports<typeof import("node:assert")>("node:assert");

export function nodeTestAdapter(moduleType: ModuleSystem): TestAdapter {
  return {
    runtime: "@ddtds/node-test/runtime",
    testImport: importFromNodeTest("test"),
    fenceImports: {
      import: [importFromNodeAssert("strict", { alias: "assert" })],
      require: [importFromNodeAssert("strict", { alias: "assert", type: "require" })],
    },
    moduleType,
  };
}
