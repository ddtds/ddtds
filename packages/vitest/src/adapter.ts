import { typedImports, type TestAdapter } from "@ddtds/core";

const importFromVitest = typedImports<typeof import("vitest")>("vitest");

/** What a fence body can use without importing it, and that makes sense inside a running test */
const MINIMAL = ["expect", "vi"] as const satisfies readonly (keyof typeof import("vitest"))[];

/** Everything vitest provides when `test.globals` is on */
const FULL = [
  ...MINIMAL,
  "suite",
  "test",
  "describe",
  "it",
  "chai",
  "assert",
  "onTestFinished",
  "onTestFailed",
  "vitest",
  "beforeAll",
  "afterAll",
  "beforeEach",
  "afterEach",
] as const satisfies readonly (keyof typeof import("vitest"))[];

export type GlobalsMode = "off" | "minimal" | "full";

function adapterOf(names: readonly (keyof typeof import("vitest"))[]): TestAdapter {
  return {
    runtime: "@ddtds/vitest/runtime",
    testImport: importFromVitest("test"),
    fenceImports: names.map((name) => importFromVitest(name)),
  };
}

const adapters: Record<GlobalsMode, TestAdapter> = {
  off: adapterOf([]),
  minimal: adapterOf(MINIMAL),
  full: adapterOf(FULL),
};

export const vitestTestAdapter: TestAdapter = adapters.minimal;

/** `test.globals` already provides everything `full` would inject, so `full` falls back to `minimal` */
export function adapterFor(mode: GlobalsMode, projectGlobals: boolean): TestAdapter {
  return adapters[mode === "full" && projectGlobals ? "minimal" : mode];
}

export function globalsIgnored(mode: GlobalsMode, projectGlobals: boolean): boolean {
  return mode === "full" && projectGlobals;
}
