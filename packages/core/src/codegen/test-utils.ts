import { CodeBlock } from "../fences/blocks.ts";
import { DdtCompileError } from "../fences/compile-error.ts";
import type { Annotation, Lang } from "../constants.ts";
import type { Fence } from "../docs/docs.ts";
import type { TestAdapter } from "./adapter.ts";

// these are unit tests and don't need to resolve
export const adapter: TestAdapter = {
  runtime: "@ddtds/test/runtime",
  testImport: "import { test } from 'test';",
  fenceImports: ["import { expect } from 'expect';"],
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

export function failingWithCause(f: Fence, cause: unknown): Fence {
  const parseError = captureParseError(fence("const = 1;"));
  const error = new DdtCompileError(parseError.details, { cause });
  Object.assign(f.block, {
    splitImports: () => {
      throw error;
    },
  });
  return f;
}

export function captureParseError(f: Fence): DdtCompileError {
  try {
    f.block.splitImports();
  } catch (error) {
    if (error instanceof DdtCompileError) return error;
    throw error;
  }
  throw new Error("expected a parse error");
}
