import { DdtCompileError, type CompileErrorDetails, type Position } from "./compile-error.ts";

/** Helpers generated doc and fence modules call. */
export type FenceRun = () => Promise<void>;
type FenceModule = { default: FenceRun };

/** The helpers a runner's runtime module must export. */
export type FenceRuntime = {
  loadFences: typeof loadFences;
  compileError: typeof compileError;
  missingCompileError: typeof missingCompileError;
  /** Passes only when the fence throws. */
  expectFailure: (run: FenceRun) => FenceRun;
};

/** Loads every fence before the doc's tests run. */
async function loadFences(loads: readonly (() => Promise<FenceModule>)[]): Promise<FenceRun[]> {
  return Promise.all(
    loads.map((load) =>
      load().then(
        ({ default: run }) => run,
        (error: unknown) => () => Promise.reject(error),
      ),
    ),
  );
}

/** Points the error's stack at the markdown. */
function thrownAt(error: Error, doc: string, { line, column }: Position): Error {
  error.stack = `${error.name}: ${error.message}\n    at ${doc}:${line}:${column}`;
  return error;
}

function compileError(doc: string, details: CompileErrorDetails, cause?: unknown): FenceRun {
  const options = cause === undefined ? undefined : { cause };
  const position = details.diagnostics[0]?.labels[0]?.start ?? details.block.range.start;
  return async () => {
    throw thrownAt(new DdtCompileError(details, options), doc, position);
  };
}

function missingCompileError(doc: string, position: Position): FenceRun {
  return async () => {
    const error = new Error("expected a compile_fail block to fail to compile");
    throw thrownAt(error, doc, position);
  };
}

/** Assembles the runtime from the one framework-specific helper. */
export function buildRuntime(expectFailure: (run: FenceRun) => FenceRun): FenceRuntime {
  return { loadFences, compileError, missingCompileError, expectFailure };
}

/** The runtime generated modules import. */
export const runtime: FenceRuntime = buildRuntime((run) => async () => {
  try {
    await run();
  } catch {
    return;
  }
  throw new Error("expected a fail block to throw");
});
