import { DdtCompileError } from "./compile-error.ts";

export const ErrorKind = {
  Compile: "compile-error",
  RuntimeFailure: "runtime-failure",
} as const;

export type ErrorKind = (typeof ErrorKind)[keyof typeof ErrorKind];

const ERROR_MESSAGES = [
  "Cannot use import statement outside a module",
  "Cannot find module",
  "is not defined",
];

function isCompileError(error: unknown): boolean {
  if (error instanceof DdtCompileError || error instanceof SyntaxError) return true;
  if (!(error instanceof Error)) return false;

  return ERROR_MESSAGES.some((message) => error.message.includes(message));
}

export class DdtTestError extends Error {
  public constructor(sourceError: unknown) {
    const message = sourceError instanceof Error ? sourceError.message : String(sourceError);
    super(message, { cause: sourceError });
    this.name = "DdtTestError";
    Object.setPrototypeOf(this, DdtTestError.prototype);
  }

  public get kind(): ErrorKind {
    return isCompileError(this.cause) ? ErrorKind.Compile : ErrorKind.RuntimeFailure;
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
