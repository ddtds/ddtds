import { expect, test } from "vitest";
import { TraceMap, generatedPositionFor, originalPositionFor } from "@jridgewell/trace-mapping";
import { docModule, fenceModule } from "./modules.ts";
import { adapter, fence } from "./test-utils.ts";

/** The 1-based line and text of the first generated line matching `matches` */
function generatedLine(code: string, matches: (line: string) => boolean) {
  const lines = code.split("\n");
  const index = lines.findIndex(matches);
  const text = lines[index];
  if (text === undefined) throw new Error("expected a matching generated line");
  return { line: index + 1, text };
}

test("a fence module default-exports its function after the imports", () => {
  expect(fenceModule(adapter, fence("import { a } from './a';\na();")).code).toBe(
    [
      "import { expect } from 'expect';",
      "import { a } from './a';",
      "export default async () => {",
      "  a();",
      "};",
    ].join("\n"),
  );
});

test("a fence module maps its code back to the markdown", () => {
  const { code, map } = fenceModule(
    adapter,
    fence("import { a } from './a';\na();", null, { line: 3 }),
  );
  expect(map.sources).toEqual(["/repo/docs/t.md"]);
  const traces = new TraceMap(JSON.parse(map.toString()));
  const { line, text } = generatedLine(code, (source) => source.includes("a();"));
  const column = text.indexOf("a");

  // the generated call resolves to the markdown line it was written on...
  expect(originalPositionFor(traces, { line, column })).toMatchObject({
    source: "/repo/docs/t.md",
    line: 5,
    column: 0,
  });
  // ...and a breakpoint on that markdown line resolves to the generated call
  expect(
    generatedPositionFor(traces, { source: "/repo/docs/t.md", line: 5, column: 0 }),
  ).toMatchObject({ line, column });
});

test("a fence module embeds the doc for debuggers that cannot resolve the path", () => {
  const { map } = fenceModule(adapter, fence("a();", null, { line: 3 }), "# Title\n");
  expect(map.file).toBe("/repo/docs/t.md");
  expect(map.sourcesContent).toEqual(["# Title\n"]);
});

test("a doc module loads each fence and registers one test per fence", () => {
  const first = fence("1;", null, { line: 3 });
  const second = { ...fence("2;", null, { line: 9 }), id: "/repo/__doctests__/t_md_9.ts" };
  expect(docModule(adapter, "/repo/docs/t.md", [first, second]).code).toBe(
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

test("a doc module maps each test call to its fence in the markdown", () => {
  const { code, map } = docModule(adapter, "/repo/docs/t.md", [fence("1;", null, { line: 3 })]);
  expect(map.sources).toEqual(["/repo/docs/t.md"]);
  const traces = new TraceMap(JSON.parse(map.toString()));
  const { line } = generatedLine(code, (source) => source.startsWith("test("));

  // the generated test() call resolves to the fence's markdown line...
  expect(originalPositionFor(traces, { line, column: 0 })).toMatchObject({
    source: "/repo/docs/t.md",
    line: 3,
    column: 0,
  });
  // ...and a breakpoint on that markdown line resolves to the generated call
  expect(
    generatedPositionFor(traces, { source: "/repo/docs/t.md", line: 3, column: 0 }),
  ).toMatchObject({ line, column: 0 });
});

test("a doc module embeds the doc for debuggers that cannot resolve the path", () => {
  const { map } = docModule(adapter, "/repo/docs/t.md", [fence("1;", null, { line: 3 })], {
    source: "# Title\n",
  });
  expect(map.file).toBe("/repo/docs/t.md");
  expect(map.sourcesContent).toEqual(["# Title\n"]);
});
