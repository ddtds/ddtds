import type { DocIndex, Fence } from "../docs.ts";
import { runtimeImport, type TestAdapter } from "./adapter.ts";
import { emitFence } from "./emit.ts";
import { planFence } from "./plan.ts";

export function fenceModule(adapter: TestAdapter, fence: Fence): string {
  const { imports, body } = emitFence(adapter, planFence(fence));
  return [...new Set(imports), `export default ${body};`].join("\n");
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
    for (const fence of fences) files.set(fence.id, fenceModule(adapter, fence));
    files.set(index.docModuleId(doc), docModule(adapter, fences));
  }
  return files;
}
