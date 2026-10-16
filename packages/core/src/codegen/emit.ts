import { MagicString } from "magic-string";
import type { FenceRuntime } from "../runtime.ts";
import { serialize } from "seroval";
import { runtimeImport, type TestAdapter } from "./adapter.ts";
import type { FenceOutcome, Fragment } from "./plan.ts";

/** One line of code, or a block whose body keeps fragments for source maps */
export type Expression =
  | { tag: "inline"; code: string }
  | { tag: "block"; open: string; body: Fragment[]; close: string };
export type FenceCode = Expression & { imports: Fragment[] };

type InlineHelper = Exclude<keyof FenceRuntime, "loadFences">;
type HelperInput<Helper extends InlineHelper> = Parameters<FenceRuntime[Helper]>[0];

function runtimeCall<Helper extends InlineHelper>(
  adapter: TestAdapter,
  helper: Helper,
  input: HelperInput<Helper>,
): FenceCode {
  return {
    imports: [runtimeImport(adapter)],
    tag: "inline",
    code: `runtime.${helper}(${serialize(input)})`,
  };
}

function indentText(text: string): string {
  return text
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

function indent(fragment: Fragment): Fragment {
  return fragment instanceof MagicString ? fragment.indent("  ") : indentText(fragment);
}

export function wrap(expression: Expression, before: string, after: string): Expression {
  if (expression.tag === "inline")
    return { tag: "inline", code: `${before}${expression.code}${after}` };
  const { open, body, close } = expression;
  return { tag: "block", open: `${before}${open}`, body, close: `${close}${after}` };
}

function asyncFunction(body: readonly Fragment[]): Expression {
  if (body.length === 0) return { tag: "inline", code: "async () => {}" };
  return { tag: "block", open: "async () => {", body: body.map(indent), close: "}" };
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
