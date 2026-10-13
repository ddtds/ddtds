import { typedImports, type TestAdapter } from "@ddtds/core";

const importFromNodeTest = typedImports<typeof import("node:test")>("node:test");

export const nodeTestAdapter: TestAdapter = {
  runtime: "@ddtds/node-test/runtime",
  testImport: importFromNodeTest("test"),
  fenceImports: ["import { strict as assert } from 'node:assert';"],
};
