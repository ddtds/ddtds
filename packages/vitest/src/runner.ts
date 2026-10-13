import { typedImports, type Runner } from "@ddtds/core";

const importFrom = typedImports<{ vitest: typeof import("vitest") }>();
const vitest = importFrom("vitest");

export const vitestRunner: Runner = {
  runtime: "@ddtds/vitest/runtime",
  testImport: vitest("test"),
  fenceImports: [vitest("expect")],
};
