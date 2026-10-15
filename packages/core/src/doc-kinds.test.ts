import { expect, test } from "vitest";
import { DOC_GLOB, isMarkdownFile, isSourceFile } from "./doc-kinds.ts";

test.each([
  ["guide.md", true, false],
  ["guide.mdx", true, false],
  ["src/a.ts", false, true],
  ["src/a.tsx", false, true],
  ["src/a.mts", false, true],
  ["src/a.cjs", false, true],
  ["src/a.json", false, false],
  ["README", false, false],
  ["src/a.ts.md", true, false],
])("%s is markdown: %s, source: %s", (path, markdown, source) => {
  expect([isMarkdownFile(path), isSourceFile(path)]).toEqual([markdown, source]);
});

test("the glob lists every extension of both kinds", () => {
  expect(DOC_GLOB).toBe("**/*.{md,mdx,ts,tsx,js,jsx,mts,cts,mjs,cjs}");
});
