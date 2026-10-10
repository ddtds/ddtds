import { type CodeBlock } from "@ddtds/core";

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

export function generateBlockFile(mdPath: string, block: CodeBlock): string {
  const name = JSON.stringify(`${mdPath}:${block.line}`);
  const { imports, body } = block.splitImports();
  const header = [VITEST_IMPORT, DDT_IMPORT, ...imports].join("\n") + "\n";

  if (block.shouldFail()) {
    const inner = `await expect(async () => {\n${indent(body)}\n}).rejects.toThrow();`;
    return `${header}${renderTest("test", name, wrapBody(inner))}`;
  }

  return `${header}${renderTest("test", name, wrapBody(body))}`;
}
