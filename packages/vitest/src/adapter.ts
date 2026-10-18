import { typedImports, type StaticImport, type TestAdapter } from "@ddtds/core";

export const vitestImports: ReturnType<typeof typedImports<typeof import("vitest")>> =
  typedImports("vitest");

/** What fences use without importing, the globals that make sense inside a running test */
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

export const vitestTestAdapter: TestAdapter = vitestAdapter(defaultGlobals);
