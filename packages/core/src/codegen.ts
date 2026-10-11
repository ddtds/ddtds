import { DdtCompileError } from "./compile-error.ts";
import type { CodeBlock } from "./blocks.ts";
import type { DocIndex, Fence } from "./docs.ts";
import type { FenceRuntime } from "./runtime.ts";

/** What a test runner puts in generated modules */
export type Runner = Readonly<{
  /** Module that exports every {@link FenceRuntime} helper */
  runtime: string;
  /** Imports `test` for doc modules */
  testImport: string;
  /** Imports every fence that runs gets, e.g. the runner's assertions */
  fenceImports: readonly string[];
}>;

/**
 * Typed `import { names } from 'module'` for generated code, with names checked against
 * each module's exports, e.g. `typedImports<{ vitest: typeof import("vitest") }>()`
 */
export function typedImports<Modules>() {
  return <Module extends keyof Modules & string>(
    module: Module,
    ...names: readonly ImportName<keyof Modules[Module] & string>[]
  ): string => `import { ${names.join(", ")} } from '${module}';`;
}

/** An export, or an export renamed with `as` */
type ImportName<Export extends string> = Export | `${Export} as ${string}`;

/**
 * A runtime module path, checked against the module's type, e.g.
 * `"@ddtds/vitest/runtime" satisfies RuntimeModule<typeof import("@ddtds/vitest/runtime")>`
 * fails to compile if that module is missing a helper generated code calls
 */
export type RuntimeModule<Runtime> = Runtime extends FenceRuntime ? string : never;

function indent(code: string): string {
  return code
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

type FenceCode = { imports: string[]; body: string };

function runtimeCall(
  runner: Runner,
  name: keyof FenceRuntime,
  ...args: readonly string[]
): FenceCode {
  const imports = [`import { ${name} } from '${runner.runtime}';`];
  return { imports, body: `${name}(${args.join(", ")})` };
}

function compileErrorCode(runner: Runner, doc: string, error: DdtCompileError): FenceCode {
  const args = [JSON.stringify(doc), JSON.stringify(error.details)];
  if (error.cause === undefined) return runtimeCall(runner, "compileError", ...args);
  const cause = JSON.stringify(serializeCause(error.cause));
  return runtimeCall(runner, "compileError", ...args, cause);
}

function serializeCause(cause: unknown): unknown {
  if (!(cause instanceof Error)) return cause;
  const code = "code" in cause ? { code: cause.code } : {};
  return { name: cause.name, message: cause.message, ...code };
}

function runCode(runner: Runner, imports: string[], body: string): FenceCode {
  return { imports: [...runner.fenceImports, ...imports], body: asyncFunction(body) };
}

const importNodeModule = typedImports<{ "node:module": typeof import("node:module") }>();
const commonJsNames = /\b(?:require|module|exports)\b/;

/** CommonJS fences get `require` resolving from the doc, like a file beside it, and a `module` */
function commonJs(doc: string): string[] {
  return [
    importNodeModule("node:module", "createRequire as __ddtCreateRequire"),
    `const require = __ddtCreateRequire(${JSON.stringify(doc)});`,
    "const module = { exports: {} };",
    "const exports = module.exports;",
  ];
}

function blockCode(runner: Runner, doc: string, block: CodeBlock): FenceCode {
  const { imports, body } = block.splitImports();
  const cjs = commonJsNames.test(block.source) ? commonJs(doc) : [];
  const run = runCode(runner, [...imports, ...cjs], body);
  if (!block.shouldFail()) return run;
  const failure = runtimeCall(runner, "expectFailure", run.body);
  return { imports: [...run.imports, ...failure.imports], body: failure.body };
}

function fenceCode(runner: Runner, { doc, block }: Fence): FenceCode {
  try {
    const code = blockCode(runner, doc, block);
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
    `import { loadFences } from '${runner.runtime}';`,
    "const fences = await loadFences([",
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
