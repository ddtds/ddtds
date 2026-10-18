import { typedImports, type ModuleSystem, type TestAdapter } from "@ddtds/core";

const importFromNodeAssert = typedImports<typeof import("node:assert")>("node:assert");

export function mochaAdapter(module: ModuleSystem): TestAdapter {
  return {
    runtime: "@ddtds/mocha/runtime",
    // Mocha defines `it` as a global while it loads specs, so docs need not resolve `mocha`
    testImport: "const { it: test } = globalThis;",
    fenceImports: [importFromNodeAssert("strict", { alias: "assert", type: module })],
    module,
    forModule: mochaAdapter,
  };
}
