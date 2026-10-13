import { expect, test } from "vitest";
import { docModule, fenceModule } from "./modules.ts";
import { adapter, fence } from "./test-utils.ts";

test("a fence module default-exports its function after the imports", () => {
  expect(fenceModule(adapter, fence("import { a } from './a';\na();"))).toBe(
    [
      "import { expect } from 'expect';",
      "import { a } from './a';",
      "export default async () => {",
      "  a();",
      "};",
    ].join("\n"),
  );
});

test("a doc module loads each fence and registers one test per fence", () => {
  const first = fence("1;", null, { line: 3 });
  const second = { ...fence("2;", null, { line: 9 }), id: "/repo/__doctests__/t_md_9.ts" };
  expect(docModule(adapter, [first, second])).toBe(
    [
      "import { test } from 'test';",
      "import { runtime } from '@ddtds/test/runtime';",
      "const fences = await runtime.loadFences([",
      '  () => import("/repo/__doctests__/t_md_3.ts"),',
      '  () => import("/repo/__doctests__/t_md_9.ts"),',
      "]);",
      'test("t.md:3", fences[0]);',
      'test("t.md:9", fences[1]);',
    ].join("\n"),
  );
});
