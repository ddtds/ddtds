import { DdtCompileError } from "./compile-error.ts";
import type { CodeBlock } from "./blocks.ts";
import type { DocIndex, Fence } from "./docs.ts";
import type { FenceRuntime } from "./runtime.ts";

type FenceRuntimeHelper = keyof FenceRuntime;

/** The imports a runner puts in generated modules. */
export type Runner = Readonly<{
  /** The runtime module path, e.g. `"@ddtds/vitest/runtime"`. */
  runtime: string;
  /** Imports `test` for doc modules, e.g. `"import { test } from 'vitest'"`. */
  testImport: string;
  /** Imports every fence run gets, e.g. `["import { expect } from 'vitest'"]`. */
  fenceImports: readonly string[];
}>;

/**
 * Typesafe `import { names } from 'module'`
 *
 * @example
 * ```ts
 * const importFromVitest = typedImports<typeof import("vitest")>("vitest");
 * const statement = importFromVitest("afterAll");
 * expect(statement).toBe("import { test } from 'vitest';");
 * ```
 */
export const typedImports =
  <Module>(module: string) =>
  (...names: (keyof Module)[]) =>
    `import { ${names.join(", ")} } from '${module}';`;

type FenceCode = { imports: string[]; body: string };

function runtimeImport(runner: Runner): string {
  return `import { runtime } from '${runner.runtime}';`;
}

function runtimeCall(
  runner: Runner,
  name: FenceRuntimeHelper,
  ...args: readonly string[]
): FenceCode {
  return { imports: [runtimeImport(runner)], body: `runtime.${name}(${args.join(", ")})` };
}

function compileErrorCode(runner: Runner, doc: string, error: DdtCompileError): FenceCode {
  const details = [JSON.stringify(doc), JSON.stringify(error.details)];
  const cause = error.cause === undefined ? [] : [JSON.stringify(serializeCause(error.cause))];
  return runtimeCall(runner, "compileError", ...details, ...cause);
}

function serializeCause(cause: unknown): unknown {
  if (!(cause instanceof Error)) return cause;
  const code = "code" in cause ? { code: cause.code } : {};
  return { name: cause.name, message: cause.message, ...code };
}

function blockCode(runner: Runner, block: CodeBlock): FenceCode {
  const { imports, body } = block.splitImports();
  const run = { imports: [...runner.fenceImports, ...imports], body: asyncFunction(body) };
  if (!block.shouldFail()) return run;
  const failure = runtimeCall(runner, "expectFailure", run.body);
  return { imports: [...run.imports, ...failure.imports], body: failure.body };
}

function fenceCode(runner: Runner, { doc, block }: Fence): FenceCode {
  try {
    const code = blockCode(runner, block);
    if (!block.shouldFailToCompile()) return code;
    const start = JSON.stringify(block.details.range.start);
    return runtimeCall(runner, "missingCompileError", JSON.stringify(doc), start);
  } catch (error) {
    if (!(error instanceof DdtCompileError)) throw error;
    if (block.shouldFailToCompile() && error.details.phase === "parse") {
      return { imports: [], body: asyncFunction("") };
    }
    return compileErrorCode(runner, doc, error);
  }
}

function indent(code: string): string {
  return code
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}
function asyncFunction(body: string): string {
  if (body.length === 0) return "async () => {}";
  return `async () => {\n${indent(body)}\n}`;
}

export function fenceModule(runner: Runner, fence: Fence): string {
  const { imports, body } = fenceCode(runner, fence);
  return [...imports, `export default ${body};`].join("\n");
}

export function docModule(runner: Runner, fences: readonly Fence[]): string {
  const loads = fences.map(({ id }) => `  () => import(${JSON.stringify(id)}),`);
  const tests = fences.map((fence, i) => {
    const name = JSON.stringify(`${fence.block.details.file}:${fence.block.line}`);
    return `test(${name}, fences[${i}]);`;
  });
  return [
    runner.testImport,
    runtimeImport(runner),
    "const fences = await runtime.loadFences([",
    ...loads,
    "]);",
    ...tests,
  ].join("\n");
}

export function moduleFiles(runner: Runner, index: DocIndex): Map<string, string> {
  const files = new Map<string, string>();
  for (const [doc, fences] of index.docs()) {
    for (const fence of fences) files.set(fence.id, fenceModule(runner, fence));
    files.set(index.docModuleId(doc), docModule(runner, fences));
  }
  return files;
}
