import { describe, expect, test } from "vitest";
import { adapterFor, globalsIgnored, vitestTestAdapter, type GlobalsMode } from "./adapter.ts";

const injected = (mode: GlobalsMode, projectGlobals = false): string[] =>
  adapterFor(mode, projectGlobals).fenceImports.flatMap(({ locals }) => locals);

describe("adapterFor", () => {
  test("off injects nothing", () => {
    expect(injected("off")).toEqual([]);
  });

  test("minimal injects what a fence body can use", () => {
    expect(injected("minimal")).toEqual(["expect", "vi"]);
  });

  test("full adds the suite and hook globals to minimal", () => {
    expect(injected("full")).toEqual(
      expect.arrayContaining([...injected("minimal"), "describe", "test", "it"]),
    );
  });

  test("each mode injects every name once", () => {
    for (const mode of ["off", "minimal", "full"] as const) {
      expect(new Set(injected(mode)).size).toBe(injected(mode).length);
    }
  });

  test("full falls back to minimal when the project enables globals", () => {
    expect(adapterFor("full", true)).toBe(adapterFor("minimal", false));
  });

  test.each(["off", "minimal"] as const)("%s ignores the project setting", (mode) => {
    expect(adapterFor(mode, true)).toBe(adapterFor(mode, false));
  });

  test("minimal is the default adapter", () => {
    expect(vitestTestAdapter).toBe(adapterFor("minimal", false));
  });
});

test.each([
  ["full", true, true],
  ["full", false, false],
  ["minimal", true, false],
  ["off", true, false],
] as const)("globalsIgnored(%s, project %s) is %s", (mode, project, ignored) => {
  expect(globalsIgnored(mode, project)).toBe(ignored);
});
