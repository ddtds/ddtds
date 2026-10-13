import { typedImportAlias, typedImports, type TestAdapter } from "@ddtds/core";

const importFromNodeTest = typedImports<typeof import("node:test")>("node:test");
const importFromNodeAssert = typedImportAlias<typeof import("node:assert")>("node:assert");

export const nodeTestAdapter: TestAdapter = {
  runtime: "@ddtds/node-test/runtime",
  testImport: importFromNodeTest("test"),
  fenceImports: [importFromNodeAssert("strict", "assert")],
};
