import type { FenceRuntime } from "../runtime.ts";
import { serialize } from "seroval";
import { runtimeImport, type TestAdapter } from "./runner.ts";
import type { FenceOutcome } from "./plan.ts";

export type FenceCode = { imports: string[]; body: string };

/** Plain data for a cause, so generated code gets `{ name, message, code? }` instead of an Error */
function serializeCause(cause: unknown): unknown {
  if (!(cause instanceof Error)) return cause;
  const withCode = "code" in cause ? { code: cause.code } : {};
  return { name: cause.name, message: cause.message, ...withCode };
}

/** Helpers called as `runtime.helper({ ... })`. `loadFences` is emitted as text in `docModule`. */
type InlineHelper = Exclude<keyof FenceRuntime, "loadFences">;
type HelperInput<Helper extends InlineHelper> = Parameters<FenceRuntime[Helper]>[0];

function runtimeCall<Helper extends InlineHelper>(
  runner: TestAdapter,
  helper: Helper,
  input: HelperInput<Helper>,
): FenceCode {
  return {
    imports: [runtimeImport(runner)],
    body: `runtime.${helper}(${serialize(input)})`,
  };
}

function indent(source: string): string {
  return source
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

function asyncFunction(body: string): string {
  if (body.length === 0) return "async () => {}";
  return `async () => {\n${indent(body)}\n}`;
}

export function emitFence(runner: TestAdapter, outcome: FenceOutcome): FenceCode {
  if (outcome.tag === "emptyPass") return { imports: [], body: asyncFunction("") };
  if (outcome.tag === "missingCompileError") {
    return runtimeCall(runner, "missingCompileError", {
      fileName: outcome.fileName,
      position: outcome.position,
    });
  }
  if (outcome.tag === "compileError") {
    return runtimeCall(runner, "compileError", {
      fileName: outcome.fileName,
      details: outcome.error.details,
      cause: serializeCause(outcome.error.cause),
    });
  }
  const imports = [...runner.fenceImports, ...outcome.imports];
  const body = asyncFunction(outcome.body);
  if (!outcome.shouldFail) return { imports, body };
  return {
    imports: [...imports, runtimeImport(runner)],
    // leave body raw and accept stringly typed to avoid needing to figure out
    // how to pass through serialize this
    body: `runtime.expectFailure({ run: ${body} })`,
  };
}
