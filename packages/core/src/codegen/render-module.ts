import { Bundle, MagicString, SourceMap, type SourceMapSegment } from "magic-string";
import type { Fence } from "../docs/docs.ts";
import type { TestAdapter } from "./adapter.ts";
import { adapterFor, runtimeImport } from "./module-system.ts";
import { isSourceFile } from "../fences/doc-kinds.ts";
import { emitFence, wrap } from "./emit.ts";
import { resolveModule } from "./resolve-module.ts";
import { planFence } from "./plan.ts";
import { renderImport } from "./static-import.ts";
import type { GeneratedModule } from "./module-types.ts";

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

export function fenceModule(
  defaultAdapter: TestAdapter,
  fence: Fence,
  source?: string,
): GeneratedModule {
  const outcome = planFence(fence);
  const module = resolveModule(fence.block, {
    syntax: outcome.tag === "run" ? outcome.syntax : "ambiguous",
    fallback: defaultAdapter.module ?? "esm",
  });
  const adapter = adapterFor(defaultAdapter, module);
  const { imports, ...expression } = emitFence(
    adapter,
    outcome,
    `${fence.block.details.file}:${fence.block.line}`,
  );
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
  return { code: bundle.toString(), map, module: adapter.module ?? "esm" };
}

const testName = ({ block }: Fence): string =>
  JSON.stringify(block.title ?? `${block.details.file}:${block.line}`);

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
    renderImport(adapter.testImport, "esm"),
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
  return { code: lines.join("\n"), map, module: "esm" };
}
