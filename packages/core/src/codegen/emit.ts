import { MagicString } from "magic-string";
import type { FenceRuntime } from "../runtime.ts";
import { serialize } from "seroval";
import { runtimeImport, type TestAdapter } from "./adapter.ts";
import type { FenceOutcome, Fragment } from "./plan.ts";

/** An expression as source pieces: the text before the body, the body lines, and the text after. */
export type Expression = { open: string; body: Fragment[]; close: string };
/** A fence's expression and the imports it needs. */
export type FenceCode = Expression & { imports: Fragment[] };

/** A runtime helper that a module calls inline, which is every helper but `loadFences`. */
type InlineHelper = Exclude<keyof FenceRuntime, "loadFences">;
/** The input a runtime helper takes. */
type HelperInput<Helper extends InlineHelper> = Parameters<FenceRuntime[Helper]>[0];

function runtimeCall<Helper extends InlineHelper>(
  adapter: TestAdapter,
  helper: Helper,
  input: HelperInput<Helper>,
): FenceCode {
  return {
    imports: [runtimeImport(adapter)],
    open: `runtime.${helper}(${serialize(input)})`,
    body: [],
    close: "",
  };
}

function indent(fragment: Fragment): Fragment {
  if (fragment instanceof MagicString) return fragment.indent("  ");
  return fragment
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

export function wrap(expression: Expression, before: string, after: string): Expression {
  const { open, body, close } = expression;
  if (body.length === 0 && close === "") return { open: `${before}${open}${after}`, body, close };
  return { open: `${before}${open}`, body, close: `${close}${after}` };
}

function asyncFunction(body: readonly Fragment[]): Expression {
  if (body.length === 0) return { open: "async () => {}", body: [], close: "" };
  return { open: "async () => {", body: body.map(indent), close: "}" };
}

function emitRun(adapter: TestAdapter, outcome: Extract<FenceOutcome, { tag: "run" }>): FenceCode {
  const imports = [...adapter.fenceImports, ...outcome.imports];
  const run = asyncFunction(outcome.body);
  if (!outcome.shouldFail) return { imports, ...run };
  return {
    imports: [...imports, runtimeImport(adapter)],
    ...wrap(run, "runtime.expectFailure({ run: ", " })"),
  };
}

export function emitFence(adapter: TestAdapter, outcome: FenceOutcome): FenceCode {
  if (outcome.tag === "emptyPass") return { imports: [], ...asyncFunction([]) };
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
