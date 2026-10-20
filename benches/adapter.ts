import type { TestAdapter } from "@ddtds/core/codegen";
import { defaultGlobals, vitestImports } from "@ddtds/vitest";

export const adapter: TestAdapter = {
  runtime: "@ddtds/vitest/runtime",
  testImport: vitestImports("test"),
  fenceImports: defaultGlobals,
};
