import { DdtCompileError, type CodeBlock } from "@ddtds/core";

function indent(code: string): string {
  return code
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

function renderTest(kind: "test" | "test.skip", name: string, body: string): string {
  if (body.length === 0) {
    return `${kind}(${name}, async () => {\n});`;
  }

  return `${kind}(${name}, async () => {\n${indent(body)}\n});`;
}

const VITEST_IMPORT = "import { test, expect } from 'vitest';";
const DDT_IMPORT = "import { DdtTestError, wrapDdtTest } from '@ddtds/vitest'";

function wrapBody(inner: string): string {
  return `await wrapDdtTest(async () => {\n${indent(inner)}\n});`;
}

function compileErrorFile(name: string, error: DdtCompileError): string {
  const imports = "import { DdtCompileError, wrapDdtTest } from '@ddtds/vitest'";
  const cause =
    error.cause === undefined ? "" : `, { cause: ${JSON.stringify(serializeCause(error.cause))} }`;
  const body = `throw new DdtCompileError(${JSON.stringify(error.details)}${cause});`;
  return `${VITEST_IMPORT}\n${imports}\n${renderTest("test", name, wrapBody(body))}`;
}

function serializeCause(cause: unknown): unknown {
  if (!(cause instanceof Error)) return cause;
  const code = "code" in cause ? { code: cause.code } : {};
  return { name: cause.name, message: cause.message, ...code };
}

export function generateBlockFile(mdPath: string, block: CodeBlock): string {
  const name = JSON.stringify(`${mdPath}:${block.line}`);
  try {
    return blockFile(name, block);
  } catch (error) {
    if (error instanceof DdtCompileError) return compileErrorFile(name, error);
    throw error;
  }
}

function blockFile(name: string, block: CodeBlock): string {
  const { imports, body } = block.splitImports();
  const header = [VITEST_IMPORT, DDT_IMPORT, ...imports].join("\n") + "\n";

  if (block.shouldFail()) {
    const inner = `await expect(async () => {\n${indent(body)}\n}).rejects.toThrow();`;
    return `${header}${renderTest("test", name, wrapBody(inner))}`;
  }

  return `${header}${renderTest("test", name, wrapBody(body))}`;
}
