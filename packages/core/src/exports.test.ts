import { expect, test } from "vitest";

test("exports only the documented public API", async () => {
  expect(Object.keys(await import("./index.ts")).toSorted()).toEqual([
    "ANNOTATIONS",
    "CodeBlock",
    "DdtCompileError",
    "DdtSession",
    "DocIndex",
    "configureLogging",
    "defaultDocsExclude",
    "defaultDocsInclude",
    "typedImports",
  ]);
});
