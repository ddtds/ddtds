import { typedImports, type TestAdapter } from "@ddtds/core";

const importFromVitest = typedImports<typeof import("vitest")>("vitest");

export const vitestRunner: TestAdapter = {
  runtime: "@ddtds/vitest/runtime",
  testImport: importFromVitest("test"),
  fenceImports: [importFromVitest("expect")],
};
