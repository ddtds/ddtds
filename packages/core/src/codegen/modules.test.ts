import { expect, test } from "vitest";
import { TraceMap, generatedPositionFor, originalPositionFor } from "@jridgewell/trace-mapping";
import { docModule, fenceModule, sourceTests } from "./modules.ts";
import { parseJsDocFences } from "../jsdoc.ts";
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

test("a fence in a JSDoc comment maps each line to its own column in the file", () => {
  const source = [
    "class A {",
    "  /**",
    "   * ```ts run",
    "   * const first = 1;",
    "   *\tconst second = 2;",
    "   *     const third = 3;",
    "   * ```",
    "   */",
    "}",
  ].join("\n");
  const [block] = parseJsDocFences(source, "src/a.ts");
  const { code, map } = fenceModule(adapter, { ...fence("", null), block: block! });
  const traces = new TraceMap(JSON.parse(map.toString()));
  const fileLines = source.split("\n");
  for (const name of ["first", "second", "third"]) {
    const { line, text } = generatedLine(code, (generated) => generated.includes(`const ${name}`));
    const original = originalPositionFor(traces, { line, column: text.indexOf("const") });
    expect(fileLines[original.line! - 1]?.slice(original.column!)).toMatch(
      new RegExp(`^const ${name}`),
    );
  }
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
      "const fences = runtime.loadFences([",
      '  () => import("/repo/__doctests__/t_md_3.ts"),',
      '  () => import("/repo/__doctests__/t_md_9.ts"),',
      "]);",
      'test("t.md:3", runtime.fenceAt(fences, 0));',
      'test("t.md:9", runtime.fenceAt(fences, 1));',
    ].join("\n"),
  );
});

test("source tests register each fence in a block that imports nothing into the file", () => {
  const first = fence("1;", null, { line: 3 });
  expect(sourceTests(adapter, [first], "host.test.run")).toBe(
    [
      "{",
      "  const test = host.test.run;",
      '  const { runtime } = await import("@ddtds/test/runtime");',
      "  const fences = runtime.loadFences([",
      '    () => import("/repo/__doctests__/t_md_3.ts"),',
      "  ]);",
      '  test("t.md:3", runtime.fenceAt(fences, 0));',
      "}",
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
