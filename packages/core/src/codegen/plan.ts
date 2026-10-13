import { inspect } from "node:util";
import type { MagicString } from "magic-string";
import { DdtCompileError, type CompileErrorDetails, type Position } from "../compile-error.ts";
import type { PreparedBlock } from "../parse.ts";
import type { Fence } from "../docs.ts";
import type { SerializedCause } from "../runtime.ts";

export type Fragment = string | MagicString;

const commonJsNames = /\b(?:require|module|exports)\b/;

function commonJs(doc: string): string[] {
  return [
    "import { createRequire as __ddtCreateRequire } from 'node:module';",
    `const require = __ddtCreateRequire(${JSON.stringify(doc)});`,
    "const module = { exports: {} };",
    "const exports = module.exports;",
  ];
}

export type FenceOutcome =
  | { tag: "run"; imports: Fragment[]; body: Fragment[]; shouldFail: boolean }
  | { tag: "missingCompileError"; fileName: string; position: Position }
  | {
      tag: "compileError";
      fileName: string;
      details: CompileErrorDetails;
      cause: SerializedCause | undefined;
    }
  | { tag: "emptyPass" };

function serializeCause(cause: unknown): SerializedCause | undefined {
  if (cause === undefined) return undefined;
  if (!(cause instanceof Error)) return { name: "UnknownCause", message: inspect(cause) };
  const code = "code" in cause && typeof cause.code === "string" ? cause.code : undefined;
  return { name: cause.name, message: cause.message, code };
}

export function planFence({ doc, block }: Fence): FenceOutcome {
  const expectsCompileFailure = block.shouldFailToCompile();
  let split: PreparedBlock;
  try {
    split = block.splitImports();
  } catch (error) {
    if (!(error instanceof DdtCompileError)) throw error;
    if (expectsCompileFailure && error.details.phase === "parse") return { tag: "emptyPass" };
    return {
      tag: "compileError",
      fileName: doc,
      details: error.details,
      cause: serializeCause(error.cause),
    };
  }
  if (expectsCompileFailure) {
    return { tag: "missingCompileError", fileName: doc, position: block.details.range.start };
  }
  const cjs = commonJsNames.test(block.code) ? commonJs(doc) : [];
  return {
    tag: "run",
    imports: [...split.imports, ...cjs],
    body: split.body,
    shouldFail: block.shouldFail(),
  };
}
