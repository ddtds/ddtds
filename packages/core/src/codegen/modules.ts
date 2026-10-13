import type { DocIndex, Fence } from "../docs.ts";
import { emitFence } from "./emit.ts";
import { planFence } from "./plan.ts";
import { runtimeImport, type TestAdapter } from "./runner.ts";

export function fenceModule(testAdapter: TestAdapter, fence: Fence): string {
  const { imports, body } = emitFence(testAdapter, planFence(fence));
  return [...new Set(imports), `export default ${body};`].join("\n");
}

export function docModule(testAdapter: TestAdapter, fences: readonly Fence[]): string {
  const loads = fences.map(({ id }) => `  () => import(${JSON.stringify(id)}),`);
  const tests = fences.map((fence, i) => {
    const name = JSON.stringify(`${fence.block.details.file}:${fence.block.line}`);
    return `test(${name}, fences[${i}]);`;
  });
  return [
    testAdapter.testImport,
    runtimeImport(testAdapter),
    "const fences = await runtime.loadFences([",
    ...loads,
    "]);",
    ...tests,
  ].join("\n");
}

export function moduleFiles(testAdapter: TestAdapter, index: DocIndex): Map<string, string> {
  const files = new Map<string, string>();
  for (const [doc, fences] of index.docs()) {
    for (const fence of fences) files.set(fence.id, fenceModule(testAdapter, fence));
    files.set(index.docModuleId(doc), docModule(testAdapter, fences));
  }
  return files;
}
