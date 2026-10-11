import { expect } from "vitest";
import { DdtCompileError, type CompileErrorDetails, type Position } from "@ddtds/core";

/** Runtime helpers that generated doc and fence modules import */

type FenceRun = () => Promise<void>;
type FenceModule = { default: FenceRun };

/** Load every fence before the doc's tests run. A fence that fails to load fails only its own test */
export async function loadFences(
  loads: readonly (() => Promise<FenceModule>)[],
): Promise<FenceRun[]> {
  return Promise.all(
    loads.map((load) =>
      load().then(
        ({ default: run }) => run,
        (error: unknown) => () => Promise.reject(error),
      ),
    ),
  );
}

export function expectFailure(run: FenceRun): FenceRun {
  return async () => {
    // A fail fence may throw any error
    // oxlint-disable-next-line vitest/require-to-throw-message
    await expect(run).rejects.toThrow();
  };
}

/** Point the error's stack at the markdown, since no generated code is to blame */
function thrownAt(error: Error, doc: string, { line, column }: Position): Error {
  error.stack = `${error.name}: ${error.message}\n    at ${doc}:${line}:${column}`;
  return error;
}

export function compileError(doc: string, details: CompileErrorDetails, cause?: unknown): FenceRun {
  const options = cause === undefined ? undefined : { cause };
  const position = details.diagnostics[0]?.labels[0]?.start ?? details.block.range.start;
  return async () => {
    throw thrownAt(new DdtCompileError(details, options), doc, position);
  };
}

export function missingCompileError(doc: string, position: Position): FenceRun {
  return async () => {
    const error = new Error("expected a compile_fail block to fail to compile");
    throw thrownAt(error, doc, position);
  };
}
