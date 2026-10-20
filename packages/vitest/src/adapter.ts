import type { TestAdapter } from "@ddtds/core/codegen";
import { typedImports, type StaticImport } from "@ddtds/core/config";

export const vitestImports: ReturnType<typeof typedImports<typeof import("vitest")>> =
  typedImports("vitest");

export const defaultGlobals: readonly StaticImport[] = [
  vitestImports("expect"),
  vitestImports("vi"),
];

export function vitestAdapter(globals: readonly StaticImport[]): TestAdapter {
  return {
    runtime: "@ddtds/vitest/runtime",
    testImport: vitestImports("test"),
    fenceImports: globals,
  };
}
