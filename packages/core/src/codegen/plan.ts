import { inspect } from "node:util";
import type { MagicString } from "magic-string";
import {
  DdtCompileError,
  type CompileErrorDetails,
  type Position,
} from "../fences/compile-error.ts";
import { splitImportsAndBlock, type ModuleSyntax, type PreparedBlock } from "../fences/parse.ts";
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
  return { name: cause.name, message: cause.message, code, stack: cause.stack };
}

type SplitBlock = (block: Fence["block"]) => PreparedBlock;

export function planFence(
  { doc, block }: Fence,
  splitBlock: SplitBlock = splitImportsAndBlock,
  typeError?: DdtCompileError,
): FenceOutcome {
  const expectsCompileFailure = block.shouldFailToCompile();
  const failed = (error: DdtCompileError): FenceOutcome =>
    expectsCompileFailure && error.details.phase !== "parser-crash"
      ? { tag: "emptyPass" }
      : {
          tag: "compileError",
          fileName: doc,
          details: error.details,
          cause: serializeCause(error.cause),
        };
  let split: PreparedBlock;
  try {
    split = splitBlock(block);
  } catch (error) {
    if (!(error instanceof DdtCompileError)) throw error;
    return failed(error);
  }
  if (typeError) return failed(typeError);
  if (expectsCompileFailure) {
    return { tag: "missingCompileError", fileName: doc, position: block.details.range.start };
  }
  // parsing and typechecking already compiled it, and loading its imports would run them
  if (block.isCompileOnly()) return { tag: "emptyPass" };
  return {
    tag: "run",
    imports: split.imports,
    importedNames: runtimeNames(split.bindings),
    body: split.body,
    shouldFail: block.shouldFail(),
    syntax: split.syntax,
  };
}
