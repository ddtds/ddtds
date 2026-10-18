import { expect, test } from "vitest";
import { adapterFor, chooseGlobals, vitestGlobalsAdapter, vitestTestAdapter } from "./adapter.ts";

test.each([
  [false, false, "none"],
  [true, false, "docs"],
  [false, true, "project"],
  [true, true, "project"],
] as const)("docs globals %s, project globals %s -> %s", (docs, project, choice) => {
  expect(chooseGlobals(docs, project)).toBe(choice);
});

test("only the docs choice injects the full global set", () => {
  expect(adapterFor("docs")).toBe(vitestGlobalsAdapter);
  expect(adapterFor("project")).toBe(vitestTestAdapter);
  expect(adapterFor("none")).toBe(vitestTestAdapter);
});

test("the globals adapter injects each global once", () => {
  const names = vitestGlobalsAdapter.fenceImports.flatMap(({ locals }) => locals);
  expect(names).toContain("describe");
  expect(names).toContain("vi");
  expect(new Set(names).size).toBe(names.length);
});
