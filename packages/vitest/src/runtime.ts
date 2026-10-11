import { expect } from "vitest";
import { DdtCompileError, type CompileErrorDetails } from "@ddtds/core";

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

export function compileError(details: CompileErrorDetails, cause?: unknown): FenceRun {
  const options = cause === undefined ? undefined : { cause };
  return () => Promise.reject(new DdtCompileError(details, options));
}

export function missingCompileError(): FenceRun {
  return () => Promise.reject(new Error("expected a compile_fail block to fail to compile"));
}
