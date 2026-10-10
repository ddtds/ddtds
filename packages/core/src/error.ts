import { DdtCompileError } from "./compile-error.ts";

export const ErrorKind = {
  Compile: "compile-error",
  RuntimeFailure: "runtime-failure",
} as const;

export type ErrorKind = (typeof ErrorKind)[keyof typeof ErrorKind];

// remove once typescript is added
const ERROR_MESSAGES = [
  "Cannot use import statement outside a module",
  "Cannot find module",
  "Cannot find package",
  "is not defined",
];

function isCompileError(error: unknown): boolean {
  if (error instanceof DdtCompileError) return true;
  if (!(error instanceof Error)) return false;

  return ERROR_MESSAGES.some((message) => error.message.includes(message));
}

export class DdtTestError extends Error {
  public readonly kind: ErrorKind;

  public constructor(sourceError: unknown) {
    const message = sourceError instanceof Error ? sourceError.message : String(sourceError);
    super(message, { cause: sourceError });
    this.name = "DdtTestError";
    this.kind = isCompileError(sourceError) ? ErrorKind.Compile : ErrorKind.RuntimeFailure;
  }
}

export async function wrapDdtTest<ReturnType>(
  run: () => Promise<ReturnType> | ReturnType,
): Promise<ReturnType> {
  try {
    return await run();
  } catch (error) {
    throw new DdtTestError(error);
  }
}
