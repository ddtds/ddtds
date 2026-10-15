/**
 * code imported at test runtime
 *
 * intentionally runtime agnostic to avoid runtime poisoning
 * e.g. satteri attempts WASI imports if test runner uses DOM runtime
 */

import {
  DdtCompileError,
  type CompileErrorDetails,
  type Position,
} from "./fences/compile-error.ts";

type FenceRun = () => Promise<void>;
type FenceModule = { default: FenceRun };

export type SerializedCause = { name: string; message: string; code?: string };

/** Points the error's stack at the markdown. */
function thrownAt(error: Error, fileName: string, { line, column }: Position): Error {
  error.stack = `${error.name}: ${error.message}\n    at ${fileName}:${line}:${column}`;
  return error;
}

export const runtime = {
  /** load imports before test execution. avoids overrunning test execution time
   * for expensive imports */
  loadFences: (loads: (() => Promise<FenceModule>)[]): Promise<FenceRun[]> =>
    Promise.all(
      loads.map((load) =>
        load().then(
          ({ default: run }) => run,
          (error: unknown) => () => Promise.reject(error),
        ),
      ),
    ),
  /** A test body that runs one of the fences from `loadFences` once it has loaded, so a test can be
   * registered before its fences finish loading */
  fenceAt:
    (fences: Promise<FenceRun[]>, index: number): FenceRun =>
    async () => {
      await (await fences)[index]?.();
    },
  /** builds a function to throw a compile error */
  compileError: ({
    fileName,
    details,
    cause,
  }: {
    fileName: string;
    details: CompileErrorDetails;
    cause?: SerializedCause;
  }): FenceRun => {
    const error = new DdtCompileError(details, { cause });
    const position = details.diagnostics[0]?.labels[0]?.start ?? details.block.range.start;

    return async () => {
      throw thrownAt(error, fileName, position);
    };
  },
  /** expected a compiler error but didn't find one */
  missingCompileError:
    ({ fileName, position }: { fileName: string; position: Position }): FenceRun =>
    async () => {
      throw thrownAt(
        new Error("expected a compile_fail block to fail to compile"),
        fileName,
        position,
      );
    },
  /** Passes only when the fence throws. */
  expectFailure:
    ({ run }: { run: FenceRun }): FenceRun =>
    async () => {
      try {
        await run();
      } catch {
        return;
      }
      throw new Error("expected a fail block to throw");
    },
} as const;

export type FenceRuntime = typeof runtime;
