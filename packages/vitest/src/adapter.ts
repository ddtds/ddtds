import { typedImports, type TestAdapter } from "@ddtds/core";

const importFromVitest = typedImports<typeof import("vitest")>("vitest");

export const vitestTestAdapter: TestAdapter = {
  runtime: "@ddtds/vitest/runtime",
  testImport: importFromVitest("test"),
  fenceImports: [importFromVitest("expect")],
};

/** What vitest provides when `test.globals` is on */
const GLOBALS = [
  "suite",
  "test",
  "describe",
  "it",
  "chai",
  "expect",
  "assert",
  "vitest",
  "vi",
  "beforeAll",
  "afterAll",
  "beforeEach",
  "afterEach",
  "onTestFailed",
  "onTestFinished",
] as const satisfies readonly (keyof typeof import("vitest"))[];

export const vitestGlobalsAdapter: TestAdapter = {
  ...vitestTestAdapter,
  fenceImports: GLOBALS.map((name) => importFromVitest(name)),
};

export type GlobalsChoice = "project" | "docs" | "none";

/** Which globals the docs get: the project's own, ours, or only `expect` */
export function chooseGlobals(docsGlobals: boolean, projectGlobals: boolean): GlobalsChoice {
  if (projectGlobals) return "project";
  return docsGlobals ? "docs" : "none";
}

export function adapterFor(choice: GlobalsChoice): TestAdapter {
  return choice === "docs" ? vitestGlobalsAdapter : vitestTestAdapter;
}
