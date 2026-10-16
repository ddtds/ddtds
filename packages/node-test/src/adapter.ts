import { typedImports, type TestAdapter } from "@ddtds/core";

const importFromNodeTest = typedImports<typeof import("node:test")>("node:test");
const importFromNodeAssert = typedImports<typeof import("node:assert")>("node:assert");

export const nodeTestAdapter: TestAdapter = {
  runtime: "@ddtds/node-test/runtime",
  testImport: importFromNodeTest("test"),
  fenceImports: [importFromNodeAssert("strict", "assert")],
  inSource: {
    imports: (kind) =>
      kind === "cjs"
        ? "const { test: ddtTest } = require('node:test');"
        : importFromNodeTest("test", "ddtTest"),
    test: "ddtTest",
    wrap: (tests) => `;(async () => ${tests})();`,
  },
};
