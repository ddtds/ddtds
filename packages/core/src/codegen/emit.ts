import { getLogger } from "@logtape/logtape";
import { MagicString } from "magic-string";
import type { FenceRuntime } from "../runtime.ts";
import { serialize } from "seroval";
import type { TestAdapter } from "./adapter.ts";
import { runtimeImport } from "./module-system.ts";
import { localName, renderImport, unshadowed } from "./static-import.ts";
import type { FenceOutcome, Fragment } from "./plan.ts";

const logger = getLogger(["ddtds", "emit"]);

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

/** Places an expression in code around it: wrap`export default ${expression};` */
export function wrap(
  [before = "", after = ""]: TemplateStringsArray,
  expression: Expression,
): Expression {
  if (expression.tag === "inline")
    return { tag: "inline", code: `${before}${expression.code}${after}` };
  const { open, body, close } = expression;
  return { tag: "block", open: `${before}${open}`, body, close: `${close}${after}` };
}

function asyncFunction(body: readonly Fragment[]): Expression {
  if (body.length === 0) return { tag: "inline", code: "async () => {}" };
  return { tag: "block", open: "async () => {", body: body.map(indent), close: "}" };
}

function emitRun(
  adapter: TestAdapter,
  outcome: Extract<FenceOutcome, { tag: "run" }>,
  where: string,
): FenceCode {
  const injected = unshadowed(adapter.fenceImports, outcome.importedNames);
  const shadowed = adapter.fenceImports.filter((fenceImport) => !injected.includes(fenceImport));
  for (const fenceImport of shadowed) {
    logger.debug(
      "{where}: fence already statically imports {name}: skipping injecting global fence import",
      () => ({
        where,
        name: localName(fenceImport),
      }),
    );
  }
  const imports = [
    ...injected.map((fenceImport) => renderImport(fenceImport, adapter.module)),
    ...outcome.imports,
  ];
  const run = asyncFunction(outcome.body);
  if (!outcome.shouldFail) return { imports, ...run };
  return {
    imports: [...imports, runtimeImport(adapter)],
    ...wrap`runtime.expectFailure({ run: ${run} })`,
  };
}

export function emitFence(adapter: TestAdapter, outcome: FenceOutcome, where: string): FenceCode {
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
  return emitRun(adapter, outcome, where);
}
