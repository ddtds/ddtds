import { Bundle, MagicString, SourceMap, type SourceMapSegment } from "magic-string";
import type { DocIndex, Fence } from "../docs.ts";
import { runtimeImport, type TestAdapter } from "./adapter.ts";
import { emitFence, wrap } from "./emit.ts";
import { planFence } from "./plan.ts";

export type GeneratedModule = { code: string; map: SourceMap };

function shiftToFence(mappings: SourceMapSegment[][], { block }: Fence): SourceMapSegment[][] {
  const { line, details } = block;
  return mappings.map((segments) =>
    segments.map((segment) => {
      if (segment.length === 1) return segment;
      const [column, source, sourceLine, sourceColumn] = segment;
      return [column, source, sourceLine + line, sourceColumn + details.indent];
    }),
  );
}

export function fenceModule(adapter: TestAdapter, fence: Fence): GeneratedModule {
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
    sources: [fence.doc],
    names: [],
    mappings: shiftToFence(mappings, fence),
  });
  return { code: bundle.toString(), map };
}

export function docModule(adapter: TestAdapter, fences: readonly Fence[]): string {
  const loads = fences.map(({ id }) => `  () => import(${JSON.stringify(id)}),`);
  const tests = fences.map((fence, i) => {
    const name = JSON.stringify(`${fence.block.details.file}:${fence.block.line}`);
    return `test(${name}, fences[${i}]);`;
  });
  return [
    adapter.testImport,
    runtimeImport(adapter),
    "const fences = await runtime.loadFences([",
    ...loads,
    "]);",
    ...tests,
  ].join("\n");
}

export function moduleFiles(adapter: TestAdapter, index: DocIndex): Map<string, string> {
  const files = new Map<string, string>();
  for (const [doc, fences] of index.docs()) {
    for (const fence of fences) files.set(fence.id, fenceModule(adapter, fence).code);
    files.set(index.docModuleId(doc), docModule(adapter, fences));
  }
  return files;
}
