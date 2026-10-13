import type { FenceRuntime, SerializedCause } from "../runtime.ts";
import { serialize } from "seroval";
import { runtimeImport, type TestAdapter } from "./runner.ts";
import type { FenceOutcome } from "./plan.ts";

export type FenceCode = { imports: string[]; body: string };

/** Plain data for a cause, so generated code gets `{ name, message, code? }` instead of an Error */
function serializeCause(cause: unknown): SerializedCause | undefined {
  if (cause === undefined) return undefined;
  if (!(cause instanceof Error)) return { name: "UnknownCause", message: String(cause) };
  const code = "code" in cause && typeof cause.code === "string" ? cause.code : undefined;
  return { name: cause.name, message: cause.message, code };
}

/** Helpers called as `runtime.helper({ ... })`. `loadFences` is emitted as text in `docModule`. */
type InlineHelper = Exclude<keyof FenceRuntime, "loadFences">;
type HelperInput<Helper extends InlineHelper> = Parameters<FenceRuntime[Helper]>[0];

function runtimeCall<Helper extends InlineHelper>(
  testAdapter: TestAdapter,
  helper: Helper,
  input: HelperInput<Helper>,
): FenceCode {
  return {
    imports: [runtimeImport(testAdapter)],
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

export function emitFence(testAdapter: TestAdapter, outcome: FenceOutcome): FenceCode {
  if (outcome.tag === "emptyPass") return { imports: [], body: asyncFunction("") };
  if (outcome.tag === "missingCompileError") {
    return runtimeCall(testAdapter, "missingCompileError", {
      fileName: outcome.fileName,
      position: outcome.position,
    });
  }
  if (outcome.tag === "compileError") {
    return runtimeCall(testAdapter, "compileError", {
      fileName: outcome.fileName,
      details: outcome.error.details,
      cause: serializeCause(outcome.error.cause),
    });
  }
  const imports = [...testAdapter.fenceImports, ...outcome.imports];
  const body = asyncFunction(outcome.body);
  if (!outcome.shouldFail) return { imports, body };
  return {
    imports: [...imports, runtimeImport(testAdapter)],
    // leave body raw and accept stringly typed to avoid needing to figure out
    // how to pass through serialize this
    body: `runtime.expectFailure({ run: ${body} })`,
  };
}
