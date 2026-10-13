import type { FenceRuntime } from "../runtime.ts";
import { serialize } from "seroval";
import { runtimeImport, type TestAdapter } from "./adapter.ts";
import type { FenceOutcome } from "./plan.ts";

export type FenceCode = { imports: string[]; body: string };

/** Helpers called as `runtime.helper({ ... })`. `loadFences` is emitted as text in `docModule`. */
type InlineHelper = Exclude<keyof FenceRuntime, "loadFences">;
type HelperInput<Helper extends InlineHelper> = Parameters<FenceRuntime[Helper]>[0];

function runtimeCall<Helper extends InlineHelper>(
  adapter: TestAdapter,
  helper: Helper,
  input: HelperInput<Helper>,
): FenceCode {
  return {
    imports: [runtimeImport(adapter)],
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

function emitRun(adapter: TestAdapter, outcome: Extract<FenceOutcome, { tag: "run" }>): FenceCode {
  const imports = [...adapter.fenceImports, ...outcome.imports];
  const body = asyncFunction(outcome.body);
  if (!outcome.shouldFail) return { imports, body };
  return {
    imports: [...imports, runtimeImport(adapter)],
    // leave body raw and accept stringly typed to avoid needing to figure out
    // how to pass through serialize this
    body: `runtime.expectFailure({ run: ${body} })`,
  };
}

export function emitFence(adapter: TestAdapter, outcome: FenceOutcome): FenceCode {
  if (outcome.tag === "emptyPass") return { imports: [], body: asyncFunction("") };
  if (outcome.tag === "missingCompileError") {
    return runtimeCall(adapter, "missingCompileError", {
      fileName: outcome.fileName,
      position: outcome.position,
    });
  }
  if (outcome.tag === "compileError") {
    return runtimeCall(adapter, "compileError", {
      fileName: outcome.fileName,
      details: outcome.details,
      cause: outcome.cause,
    });
  }
  return emitRun(adapter, outcome);
}
