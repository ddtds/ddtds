import { DdtSyntaxError, type CodeBlock } from "@ddtds/core";

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

function syntaxErrorFile(name: string, error: DdtSyntaxError): string {
  const imports = "import { DdtSyntaxError, wrapDdtTest } from '@ddtds/vitest'";
  const body = `throw new DdtSyntaxError(${JSON.stringify(error.message)});`;
  return `${VITEST_IMPORT}\n${imports}\n${renderTest("test", name, wrapBody(body))}`;
}

export function generateBlockFile(mdPath: string, block: CodeBlock): string {
  const name = JSON.stringify(`${mdPath}:${block.line}`);
  let prepared: { imports: string[]; body: string };
  try {
    prepared = block.splitImports();
  } catch (error) {
    if (error instanceof DdtSyntaxError) return syntaxErrorFile(name, error);
    throw error;
  }
  const { imports, body } = prepared;
  const header = [VITEST_IMPORT, DDT_IMPORT, ...imports].join("\n") + "\n";

  if (block.shouldFail()) {
    const inner = `await expect(async () => {\n${indent(body)}\n}).rejects.toThrow();`;
    return `${header}${renderTest("test", name, wrapBody(inner))}`;
  }

  return `${header}${renderTest("test", name, wrapBody(body))}`;
}
