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

export function docModule(
  adapter: TestAdapter,
  doc: string,
  fences: readonly Fence[],
  { source }: { source?: string } = {},
): GeneratedModule {
  const lines = [
    adapter.testImport,
    runtimeImport(adapter),
    "const fences = await runtime.loadFences([",
    ...fences.map(({ id }) => `  () => import(${JSON.stringify(id)}),`),
    "]);",
  ];
  const mappings: SourceMapSegment[][] = lines.map(() => []);
  for (const [i, { block }] of fences.entries()) {
    const name = JSON.stringify(`${block.details.file}:${block.line}`);
    lines.push(`test(${name}, fences[${i}]);`);
    const { line, column } = block.zeroBasedStart;
    mappings.push([[0, 0, line, column]]);
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
