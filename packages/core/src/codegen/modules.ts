import { Bundle, MagicString, SourceMap, type SourceMapSegment } from "magic-string";
import type { DocIndex, Fence } from "../docs/docs.ts";
import { runtimeImport, type TestAdapter } from "./adapter.ts";
import { isSourceFile } from "../fences/doc-kinds.ts";
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
  const exported =
    adapter.module === "cjs"
      ? wrap`module.exports = ${expression};`
      : wrap`export default ${expression};`;
  const pieces =
    exported.tag === "inline"
      ? [...imports, exported.code]
      : [...imports, exported.open, ...exported.body, exported.close];

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

const loadFences = (fences: readonly Fence[]): string[] => [
  "const fences = await runtime.loadFences([",
  ...importFences(fences),
  "]);",
];

export function docModule(
  adapter: TestAdapter,
  doc: string,
  fences: readonly Fence[],
  { source }: { source?: string } = {},
): GeneratedModule {
  // load the file before its fences import it by package name
  const self = isSourceFile(doc) ? [`import ${JSON.stringify(doc)};`] : [];
  const header = [
    ...self,
    adapter.testImport,
    runtimeImport(adapter, "esm"),
    ...loadFences(fences),
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

/** Module for an entry or fence id */
export function moduleFor(
  adapter: TestAdapter,
  index: DocIndex,
  id: string,
): GeneratedModule | undefined {
  const doc = index.docOfEntry(id);
  if (doc !== undefined) {
    return docModule(adapter, doc, index.fencesOf(doc), { source: index.sourceOf(doc) });
  }
  const fence = index.fence(id);
  if (!fence) return undefined;
  return fenceModule(adapter, fence, index.sourceOf(fence.doc));
}
