import { basename } from "node:path";
import {
  DdtCompileError,
  docModuleName,
  type CodeBlock,
  type DocIndex,
  type Fence,
} from "@ddtds/core";

function indent(code: string): string {
  return code
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

function wrapBody(inner: string): string {
  return `await wrapDdtTest(async () => {\n${indent(inner)}\n});`;
}

const DDT_IMPORT = "import { DdtTestError, wrapDdtTest } from '@ddtds/vitest'";

type FenceCode = { imports: string[]; body: string };

function compileErrorCode(error: DdtCompileError): FenceCode {
  const cause =
    error.cause === undefined ? "" : `, { cause: ${JSON.stringify(serializeCause(error.cause))} }`;
  const body = `throw new DdtCompileError(${JSON.stringify(error.details)}${cause});`;
  return {
    imports: ["import { DdtCompileError, wrapDdtTest } from '@ddtds/vitest'"],
    body: wrapBody(body),
  };
}

function serializeCause(cause: unknown): unknown {
  if (!(cause instanceof Error)) return cause;
  const code = "code" in cause ? { code: cause.code } : {};
  return { name: cause.name, message: cause.message, ...code };
}

function compiledCode(): FenceCode {
  const body = 'throw new Error("expected a compile_fail block to fail to compile");';
  return { imports: [DDT_IMPORT], body: wrapBody(body) };
}

function blockCode(block: CodeBlock): FenceCode {
  const { imports, body } = block.splitImports();

  if (block.shouldFail()) {
    const inner = `await expect(async () => {\n${indent(body)}\n}).rejects.toThrow();`;
    return { imports: [DDT_IMPORT, ...imports], body: wrapBody(inner) };
  }

  return { imports: [DDT_IMPORT, ...imports], body: wrapBody(body) };
}

function fenceCode(block: CodeBlock): FenceCode {
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

export function fenceModule(block: CodeBlock): string {
  const { imports, body } = fenceCode(block);
  const header = ["import { expect } from 'vitest';", ...imports].join("\n");
  const run = body.length === 0 ? "" : `\n${indent(body)}\n`;
  return `${header}\nexport default async function () {${run}}`;
}

export function docModule(fences: readonly Fence[], importPath: (fence: Fence) => string): string {
  const tests = fences.map((fence) => {
    const name = JSON.stringify(`${fence.block.details.file}:${fence.block.line}`);
    const load = `await wrapDdtTest(() => import(${JSON.stringify(importPath(fence))}))`;
    return `test(${name}, async () => {\n  const { default: run } = ${load};\n  await run();\n});`;
  });
  return [
    "import { test } from 'vitest';",
    "import { wrapDdtTest } from '@ddtds/vitest'",
    ...tests,
  ].join("\n");
}

/** Files for `ddt build`: one doc module per doc, importing its fence modules next to it. */
export function moduleFiles(index: DocIndex, root: string): Map<string, string> {
  const files = new Map<string, string>();
  for (const [doc, fences] of index.docs) {
    for (const fence of fences) files.set(basename(fence.id), fenceModule(fence.block));
    files.set(
      docModuleName(root, doc),
      docModule(fences, (fence) => `./${basename(fence.id)}`),
    );
  }
  return files;
}
