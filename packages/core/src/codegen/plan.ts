import { DdtCompileError, type Position } from "../compile-error.ts";
import type { Fence } from "../docs.ts";

/** Intermediate representation for code fences. Splits out category and rendering logic */
export type FenceOutcome =
  | { tag: "run"; imports: string[]; body: string; shouldFail: boolean }
  | { tag: "missingCompileError"; fileName: string; position: Position }
  | { tag: "compileError"; fileName: string; error: DdtCompileError }
  | { tag: "emptyPass" };

export function planFence({ doc, block }: Fence): FenceOutcome {
  try {
    const { imports, body } = block.splitImports();
    if (block.shouldFailToCompile()) {
      return { tag: "missingCompileError", fileName: doc, position: block.details.range.start };
    }
    return { tag: "run", imports, body, shouldFail: block.shouldFail() };
  } catch (error) {
    if (!(error instanceof DdtCompileError)) throw error;
    if (block.shouldFailToCompile() && error.details.phase === "parse") {
      return { tag: "emptyPass" };
    }
    return { tag: "compileError", fileName: doc, error };
  }
}
