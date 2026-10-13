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

export function docModule(
  adapter: TestAdapter,
  doc: string,
  fences: readonly Fence[],
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
    // Runners locate a test where test() is called, so point the call at its fence
    mappings.push([[0, 0, block.line - 1, block.details.indent]]);
  }
  const map = new SourceMap({ sources: [doc], names: [], mappings });
  return { code: lines.join("\n"), map };
}

export function moduleFiles(adapter: TestAdapter, index: DocIndex): Map<string, string> {
  const files = new Map<string, string>();
  for (const [doc, fences] of index.docs()) {
    for (const fence of fences) files.set(fence.id, fenceModule(adapter, fence).code);
    files.set(index.docModuleId(doc), docModule(adapter, doc, fences).code);
  }
  return files;
}
