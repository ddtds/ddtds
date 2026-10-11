import { DdtCompileError, type CodeBlock, type DocIndex, type Fence } from "@ddtds/core";

type DdtVitestExports = keyof typeof import("./index.ts");

function indent(code: string): string {
  return code
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

function ddtImport(...names: readonly DdtVitestExports[]): string {
  return `import { ${names.join(", ")} } from '@ddtds/vitest';`;
}

type FenceCode = { imports: string[]; body: string };

function compileErrorCode(error: DdtCompileError): FenceCode {
  const cause =
    error.cause === undefined ? "" : `, { cause: ${JSON.stringify(serializeCause(error.cause))} }`;
  const body = `throw new DdtCompileError(${JSON.stringify(error.details)}${cause});`;
  return { imports: [ddtImport("DdtCompileError")], body };
}

function serializeCause(cause: unknown): unknown {
  if (!(cause instanceof Error)) return cause;
  const code = "code" in cause ? { code: cause.code } : {};
  return { name: cause.name, message: cause.message, ...code };
}

function compiledCode(): FenceCode {
  return {
    imports: [],
    body: 'throw new Error("expected a compile_fail block to fail to compile");',
  };
}

function blockCode(block: CodeBlock): FenceCode {
  const { imports, body } = block.splitImports();
  if (!block.shouldFail()) return { imports, body };
  const rejects = `await expect(async () => {\n${indent(body)}\n}).rejects.toThrow();`;
  return { imports, body: rejects };
}

function fenceCode({ block }: Fence): FenceCode {
  try {
    const code = blockCode(block);
    return block.shouldFailToCompile() ? compiledCode() : code;
  } catch (error) {
    if (!(error instanceof DdtCompileError)) throw error;
    if (block.shouldFailToCompile() && error.details.phase === "parse") {
      return { imports: [], body: "" };
    }
    return compileErrorCode(error);
  }
}

export function fenceModule(fence: Fence): string {
  const { imports, body } = fenceCode(fence);
  const header = ["import { expect } from 'vitest';", ...imports].join("\n");
  const run = body.length === 0 ? "" : `\n${indent(body)}\n`;
  return `${header}\nexport default async function () {${run}}`;
}

export function docModule(fences: readonly Fence[]): string {
  const loads = fences.map(
    ({ id }) =>
      `  import(${JSON.stringify(id)}).then(\n    ({ default: run }) => run,\n    (error) => () => {\n      throw error;\n    },\n  ),`,
  );
  const tests = fences.map((fence, i) => {
    const name = JSON.stringify(`${fence.block.details.file}:${fence.block.line}`);
    return `test(${name}, fences[${i}]);`;
  });
  return [
    "import { test } from 'vitest';",
    "const fences = await Promise.all([",
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
