import { Bundle, MagicString, SourceMap, type SourceMapSegment } from "magic-string";
import type { DocIndex, Fence } from "../docs.ts";
import { runtimeImport, type TestAdapter } from "./adapter.ts";
import { emitFence, wrap } from "./emit.ts";
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

const loadFences = (fences: readonly Fence[]): string[] => [
  "const fences = runtime.loadFences([",
  ...fences.map(({ id }) => `  () => import(${JSON.stringify(id)}),`),
  "]);",
];

const testCall = (fence: Fence, i: number): string =>
  `test(${testName(fence)}, runtime.fenceAt(fences, ${i}));`;

/** Starts loading the fences and registers one test per fence, with `test` and `runtime` in scope */
const registerFences = (fences: readonly Fence[]): string[] => [
  ...loadFences(fences),
  ...fences.map(testCall),
];

/**
 * Code appended to a source file to register its fences as tests. `test` is an expression for the
 * host's `test` function, so the file imports nothing from the test runner. The code is a block,
 * and the host decides when it runs, such as only while the file is a test.
 *
 * The fences are not awaited, because a fence usually imports the file it documents, and waiting
 * for it here would wait on the file itself.
 */
export function sourceTests(adapter: TestAdapter, fences: readonly Fence[], test: string): string {
  const lines = [
    `const test = ${test};`,
    `const { runtime } = await import(${JSON.stringify(adapter.runtime)});`,
    ...registerFences(fences),
  ];
  return ["{", ...lines.map((line) => `  ${line}`), "}"].join("\n");
}

export function docModule(
  adapter: TestAdapter,
  doc: string,
  fences: readonly Fence[],
  { source }: { source?: string } = {},
): GeneratedModule {
  const header = [adapter.testImport, runtimeImport(adapter), ...loadFences(fences)];
  const lines = [...header, ...fences.map(testCall)];
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
