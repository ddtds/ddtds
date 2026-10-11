import { DdtCompileError, type CodeBlock, type DocIndex, type Fence } from "@ddtds/core";

type ModuleExports = {
  vitest: typeof import("vitest");
  "@ddtds/vitest/runtime": typeof import("@ddtds/vitest/runtime");
};

function indent(code: string): string {
  return code
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

function importFrom<Module extends keyof ModuleExports>(
  module: Module,
  ...names: readonly (keyof ModuleExports[Module] & string)[]
): string {
  return `import { ${names.join(", ")} } from '${module}';`;
}

type FenceCode = { imports: string[]; body: string };

function runtimeCall(
  name: keyof ModuleExports["@ddtds/vitest/runtime"],
  ...args: readonly string[]
): FenceCode {
  const imports = [importFrom("@ddtds/vitest/runtime", name)];
  return { imports, body: `${name}(${args.join(", ")})` };
}

function compileErrorCode(error: DdtCompileError): FenceCode {
  const details = JSON.stringify(error.details);
  if (error.cause === undefined) return runtimeCall("compileError", details);
  return runtimeCall("compileError", details, JSON.stringify(serializeCause(error.cause)));
}

function serializeCause(cause: unknown): unknown {
  if (!(cause instanceof Error)) return cause;
  const code = "code" in cause ? { code: cause.code } : {};
  return { name: cause.name, message: cause.message, ...code };
}

function runCode(imports: string[], body: string): FenceCode {
  return { imports: [importFrom("vitest", "expect"), ...imports], body: asyncFunction(body) };
}

function blockCode(block: CodeBlock): FenceCode {
  const { imports, body } = block.splitImports();
  const run = runCode(imports, body);
  if (!block.shouldFail()) return run;
  const failure = runtimeCall("expectFailure", run.body);
  return { imports: [...run.imports, ...failure.imports], body: failure.body };
}

function fenceCode({ block }: Fence): FenceCode {
  try {
    const code = blockCode(block);
    if (!block.shouldFailToCompile()) return code;
    return runtimeCall("missingCompileError");
  } catch (error) {
    if (!(error instanceof DdtCompileError)) throw error;
    if (block.shouldFailToCompile() && error.details.phase === "parse") {
      return { imports: [], body: asyncFunction("") };
    }
    return compileErrorCode(error);
  }
}

function asyncFunction(body: string): string {
  if (body.length === 0) return "async () => {}";
  return `async () => {\n${indent(body)}\n}`;
}

export function fenceModule(fence: Fence): string {
  const { imports, body } = fenceCode(fence);
  return [...imports, `export default ${body};`].join("\n");
}

export function docModule(fences: readonly Fence[]): string {
  const loads = fences.map(({ id }) => `  () => import(${JSON.stringify(id)}),`);
  const tests = fences.map((fence, i) => {
    const name = JSON.stringify(`${fence.block.details.file}:${fence.block.line}`);
    return `test(${name}, fences[${i}]);`;
  });
  return [
    importFrom("vitest", "test"),
    importFrom("@ddtds/vitest/runtime", "loadFences"),
    "const fences = await loadFences([",
    ...loads,
    "]);",
    ...tests,
  ].join("\n");
}

export function moduleFiles(index: DocIndex): Map<string, string> {
  const files = new Map<string, string>();
  for (const [doc, fences] of index.docs()) {
    for (const fence of fences) files.set(fence.id, fenceModule(fence));
    files.set(index.docModuleId(doc), docModule(fences));
  }
  return files;
}
