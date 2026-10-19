import { inspect } from "node:util";
import type { MagicString } from "magic-string";
import {
  DdtCompileError,
  type CompileErrorDetails,
  type Position,
} from "../fences/compile-error.ts";
import type { ModuleSyntax, PreparedBlock } from "../fences/parse.ts";
import type { Fence } from "../docs/docs.ts";
import type { SerializedCause } from "../runtime.ts";
import { runtimeNames } from "./static-import.ts";

export type Fragment = string | MagicString;

export type FenceOutcome =
  | {
      tag: "run";
      imports: Fragment[];
      importedNames: string[];
      body: Fragment[];
      shouldFail: boolean;
      compileOnly: boolean;
      syntax: ModuleSyntax;
    }
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
  return {
    tag: "run",
    imports: split.imports,
    importedNames: runtimeNames(split.bindings),
    body: split.body,
    shouldFail: block.shouldFail(),
    compileOnly: block.isCompileOnly(),
    syntax: split.syntax,
  };
}
