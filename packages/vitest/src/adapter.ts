import { typedImports, type TestAdapter } from "@ddtds/core";

const importFromVitest = typedImports<typeof import("vitest")>("vitest");

export const vitestTestAdapter: TestAdapter = {
  runtime: "@ddtds/vitest/runtime",
  testImport: importFromVitest("test"),
  fenceImports: [importFromVitest("expect")],
  inSource: {
    test: "import.meta.vitest.test",
    suite: "import.meta.vitest.describe",
    wrap: (tests) => `if (import.meta.vitest) ${tests}`,
  },
};
