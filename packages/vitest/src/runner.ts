import { typedImports, type Runner } from "@ddtds/core";

const importFromVitest = typedImports<typeof import("vitest")>("vitest");

export const vitestRunner: Runner = {
  runtime: "@ddtds/vitest/runtime",
  testImport: importFromVitest("test"),
  fenceImports: [importFromVitest("expect")],
};
