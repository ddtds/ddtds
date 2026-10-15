import { Bundle, MagicString, SourceMap, type SourceMapSegment } from "magic-string";
import type { DocIndex, Fence } from "../docs/docs.ts";
import { runtimeImport, type TestAdapter } from "./adapter.ts";
import { emitFence, indentText, wrap } from "./emit.ts";
import { planFence } from "./plan.ts";

export type GeneratedModule = { code: string; map: SourceMap };

function shiftToFence(mappings: SourceMapSegment[][], { block }: Fence): SourceMapSegment[][] {
  return mappings.map((segments) =>
    segments.map((segment) => {
      if (segment.length === 1) return segment;
      const [column, source, sourceLine, sourceColumn] = segment;
      const { line, column: fileColumn } = block.zeroBasedPositionAt(sourceLine, sourceColumn);
      return [column, source, line, fileColumn];
    }),
  );
}

export function fenceModule(adapter: TestAdapter, fence: Fence, source?: string): GeneratedModule {
  const { imports, ...expression } = emitFence(adapter, planFence(fence));
  const { open, body, close } = wrap(expression, "export default ", ";");
  const pieces = [...imports, open, ...body, ...(close === "" ? [] : [close])];

  const bundle = new Bundle({ separator: "\n" });
  for (const piece of pieces) {
    if (typeof piece === "string") bundle.addSource(new MagicString(piece));
    else bundle.addSource({ filename: fence.doc, content: piece });
  }

  const { mappings } = bundle.generateDecodedMap({ hires: "boundary" });
  const map = new SourceMap({
    file: fence.doc,
    sources: [fence.doc],
    ...(source === undefined ? {} : { sourcesContent: [source] }),
    names: [],
    mappings: shiftToFence(mappings, fence),
  });
  return { code: bundle.toString(), map };
}

const testName = ({ block }: Fence): string =>
  JSON.stringify(`${block.details.file}:${block.line}`);

const importFences = (fences: readonly Fence[]): string[] =>
  fences.map(({ id }) => `  () => import(${JSON.stringify(id)}),`);

/**
 * for most runners, jsdoc fences arent loaded if the
 * source file isnt imported int a test
 *
 * fences arent waited since jsdoc is very often
 * a self import and would cause a desdlock
 *
 * with a `suite`, the fences load inside the suite callback instead. the runner
 * waits for that callback after the file has loaded, so there is no deadlock and the
 * load time isnt charged to a test's timeout
 */
export function sourceTests(
  adapter: TestAdapter,
  fences: readonly Fence[],
  test: string,
  suite?: string,
): string {
  const loadRuntime = `const { runtime } = await import(${JSON.stringify(adapter.runtime)});`;
  const lines =
    suite === undefined
      ? [
          `const test = ${test};`,
          loadRuntime,
          "const fences = runtime.loadFences([",
          ...importFences(fences),
          "]);",
          ...fences.map((fence, i) => `test(${testName(fence)}, runtime.fenceAt(fences, ${i}));`),
        ]
      : [
          `const test = ${test};`,
          `${suite}(${JSON.stringify(fences[0]?.block.details.file)}, async () => {`,
          ...[
            loadRuntime,
            "const fences = await runtime.loadFences([",
            ...importFences(fences),
            "]);",
            ...fences.map((fence, i) => `test(${testName(fence)}, fences[${i}]);`),
          ].map(indentText),
          "});",
        ];
  return ["{", ...lines.map(indentText), "}"].join("\n");
}

export function docModule(
  adapter: TestAdapter,
  doc: string,
  fences: readonly Fence[],
  { source }: { source?: string } = {},
): GeneratedModule {
  const header = [
    adapter.testImport,
    runtimeImport(adapter),
    "const fences = await runtime.loadFences([",
    ...importFences(fences),
    "]);",
  ];
  const lines = [...header, ...fences.map((fence, i) => `test(${testName(fence)}, fences[${i}]);`)];
  const mappings: SourceMapSegment[][] = [
    ...header.map(() => []),
    ...fences.map(({ block }): SourceMapSegment[] => {
      const { line, column } = block.zeroBasedStart;
      return [[0, 0, line, column]];
    }),
  ];
  const map = new SourceMap({
    file: doc,
    sources: [doc],
    ...(source === undefined ? {} : { sourcesContent: [source] }),
    names: [],
    mappings,
  });
  return { code: lines.join("\n"), map };
}

export function moduleFiles(adapter: TestAdapter, index: DocIndex): Map<string, string> {
  const files = new Map<string, string>();
  for (const [doc, fences] of index.docs()) {
    const source = index.sourceOf(doc);
    for (const fence of fences) files.set(fence.id, fenceModule(adapter, fence, source).code);
    files.set(index.docModuleId(doc), docModule(adapter, doc, fences, { source }).code);
  }
  return files;
}

/** The module a host serves for a doc or fence id, or `undefined` when the id is neither. */
export function moduleFor(
  adapter: TestAdapter,
  index: DocIndex,
  id: string,
): GeneratedModule | undefined {
  if (index.hasDoc(id)) {
    return docModule(adapter, id, index.fencesOf(id), { source: index.sourceOf(id) });
  }
  const fence = index.fence(id);
  if (!fence) return undefined;
  return fenceModule(adapter, fence, index.sourceOf(fence.doc));
}
