import { Bundle, MagicString, SourceMap, type SourceMapSegment } from "magic-string";
import type { DocIndex, Fence } from "../docs.ts";
import { runtimeImport, type TestAdapter } from "./adapter.ts";
import { emitFence, wrap } from "./emit.ts";
import { planFence } from "./plan.ts";

export type GeneratedModule = { code: string; map: SourceMap };

function shiftToFence(mappings: SourceMapSegment[][], { block }: Fence): SourceMapSegment[][] {
  const { line } = block;
  return mappings.map((segments) =>
    segments.map((segment) => {
      if (segment.length === 1) return segment;
      const [column, source, sourceLine, sourceColumn] = segment;
      return [column, source, sourceLine + line, sourceColumn + block.indentAt(sourceLine)];
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

const loadFences = (fences: readonly Fence[], wait = "await "): string[] => [
  `const fences = ${wait}runtime.loadFences([`,
  ...fences.map(({ id }) => `  () => import(${JSON.stringify(id)}),`),
  "]);",
];

/**
 * Code appended to a source file to register its fences as tests. `when` is a condition that
 * holds only while the host runs the file as a test, and `test` is an expression for the host's
 * `test` function, so the file imports nothing from the test runner outside of tests.
 *
 * The fences start loading at once but are not awaited, because a fence usually imports the file
 * it documents, and waiting for it here would wait on the file itself.
 */
export function sourceTests(
  adapter: TestAdapter,
  fences: readonly Fence[],
  { when, test }: { when: string; test: string },
): string {
  const lines = [
    `const test = ${test};`,
    `const { runtime } = await import(${JSON.stringify(adapter.runtime)});`,
    ...loadFences(fences, ""),
    ...fences.map((fence, i) => `test(${testName(fence)}, runtime.fenceAt(fences, ${i}));`),
  ];
  return [`if (${when}) {`, ...lines.map((line) => `  ${line}`), "}"].join("\n");
}

export function docModule(
  adapter: TestAdapter,
  doc: string,
  fences: readonly Fence[],
  { source }: { source?: string } = {},
): GeneratedModule {
  const lines = [adapter.testImport, runtimeImport(adapter), ...loadFences(fences)];
  const mappings: SourceMapSegment[][] = lines.map(() => []);
  for (const [i, fence] of fences.entries()) {
    lines.push(`test(${testName(fence)}, fences[${i}]);`);
    mappings.push([[0, 0, fence.block.line - 1, fence.block.details.indent]]);
  }
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
