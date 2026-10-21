import { CodeBlock } from "../fences/blocks.ts";
import { DdtCompileError } from "../fences/compile-error.ts";
import type { Annotation } from "../annotations.ts";
import type { Lang } from "../languages.ts";
import type { Fence } from "../docs/docs.ts";
import { splitImportsAndBlock, type ParseableBlock, type PreparedBlock } from "../fences/parse.ts";
import type { TestAdapter } from "./adapter.ts";
import { typedImports } from "../config.ts";

const testImports = typedImports<Record<string, unknown>>("test");
const expectImports = typedImports<Record<string, unknown>>("expect");

// these are unit tests and don't need to resolve
export const adapter: TestAdapter = {
  runtime: "@ddtds/test/runtime",
  testImport: testImports("test"),
  fenceImports: [expectImports("expect")],
  module: "esm",
};

export function fence(
  code: string,
  annotation: Annotation | null = null,
  { lang = "ts", line = 3 }: { lang?: Lang; line?: number } = {},
): Fence {
  return {
    id: "/repo/__doctests__/t_md_3.ts",
    doc: "/repo/docs/t.md",
    block: new CodeBlock({
      code,
      lang,
      annotation,
      path: "t.md",
      rangeInText: { start: { line, column: 1 }, end: { line: line + 2, column: 4 } },
    }),
  };
}

export function failingWithCause(
  f: Fence,
  cause: unknown,
): { fence: Fence; split: (block: ParseableBlock) => PreparedBlock } {
  const parseError = captureParseError(fence("const = 1;"));
  const error = new DdtCompileError(parseError.details, { cause });
  return {
    fence: f,
    split: () => {
      throw error;
    },
  };
}

export function captureParseError(f: Fence): DdtCompileError {
  try {
    splitImportsAndBlock(f.block);
  } catch (error) {
    if (error instanceof DdtCompileError) return error;
    throw error;
  }
  throw new Error("expected a parse error");
}
