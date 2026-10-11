import { Bundle, MagicString, SourceMap, type SourceMapSegment } from "magic-string";
import { DdtCompileError } from "./compile-error.ts";
import type { CodeBlock } from "./blocks.ts";
import type { DocIndex, Fence } from "./docs.ts";
import type { FenceRuntime } from "./runtime.ts";

/** What a test runner puts in generated modules */
export type Runner = Readonly<{
  /** Module that exports every {@link FenceRuntime} helper */
  runtime: string;
  /** Imports `test` for doc modules */
  testImport: string;
  /** Imports every fence that runs gets, e.g. the runner's assertions */
  fenceImports: readonly string[];
}>;

/**
 * Typed `import { names } from 'module'` for generated code, with names checked against
 * each module's exports, e.g. `typedImports<{ vitest: typeof import("vitest") }>()`
 */
export function typedImports<Modules>() {
  return <Module extends keyof Modules & string>(
    module: Module,
    ...names: readonly ImportName<keyof Modules[Module] & string>[]
  ): string => `import { ${names.join(", ")} } from '${module}';`;
}

/** An export, or an export renamed with `as` */
type ImportName<Export extends string> = Export | `${Export} as ${string}`;

/**
 * A runtime module path, checked against the module's type, e.g.
 * `"@ddtds/vitest/runtime" satisfies RuntimeModule<typeof import("@ddtds/vitest/runtime")>`
 * fails to compile if that module is missing a helper generated code calls
 */
export type RuntimeModule<Runtime> = Runtime extends FenceRuntime ? string : never;

export type GeneratedModule = { code: string; map: SourceMap };

/** Generated text, or a piece of the fence's code that maps back to the markdown */
type Piece = string | MagicString;

/** An expression over lines: `open`, then `body`, then `close` */
type Expression = { open: string; body: Piece[]; close: string };
type FenceCode = { imports: Piece[]; expression: Expression };

function indent(piece: Piece): Piece {
  if (piece instanceof MagicString) return piece.indent("  ");
  return piece
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

function wrap({ open, body, close }: Expression, before: string, after: string): Expression {
  if (body.length === 0 && close === "") return { open: `${before}${open}${after}`, body, close };
  return { open: `${before}${open}`, body, close: `${close}${after}` };
}

function asyncFunction(body: readonly Piece[]): Expression {
  if (body.length === 0) return { open: "async () => {}", body: [], close: "" };
  return { open: "async () => {", body: body.map(indent), close: "}" };
}

function runtimeCall(runner: Runner, name: keyof FenceRuntime, ...args: string[]): FenceCode {
  const imports = [`import { ${name} } from '${runner.runtime}';`];
  return { imports, expression: { open: `${name}(${args.join(", ")})`, body: [], close: "" } };
}

function compileErrorCode(runner: Runner, doc: string, error: DdtCompileError): FenceCode {
  const args = [JSON.stringify(doc), JSON.stringify(error.details)];
  if (error.cause === undefined) return runtimeCall(runner, "compileError", ...args);
  const cause = JSON.stringify(serializeCause(error.cause));
  return runtimeCall(runner, "compileError", ...args, cause);
}

function serializeCause(cause: unknown): unknown {
  if (!(cause instanceof Error)) return cause;
  const code = "code" in cause ? { code: cause.code } : {};
  return { name: cause.name, message: cause.message, ...code };
}

const importNodeModule = typedImports<{ "node:module": typeof import("node:module") }>();
const commonJsNames = /\b(?:require|module|exports)\b/;

/** CommonJS fences get `require` resolving from the doc, like a file beside it, and a `module` */
function commonJs(doc: string): string[] {
  return [
    importNodeModule("node:module", "createRequire as __ddtCreateRequire"),
    `const require = __ddtCreateRequire(${JSON.stringify(doc)});`,
    "const module = { exports: {} };",
    "const exports = module.exports;",
  ];
}

function blockCode(runner: Runner, doc: string, block: CodeBlock): FenceCode {
  const { imports, body } = block.splitImports();
  const cjs = commonJsNames.test(block.code) ? commonJs(doc) : [];
  const run = {
    imports: [...runner.fenceImports, ...imports, ...cjs],
    expression: asyncFunction(body),
  };
  if (!block.shouldFail()) return run;
  const { imports: failure } = runtimeCall(runner, "expectFailure");
  const expression = wrap(run.expression, "expectFailure(", ")");
  return { imports: [...run.imports, ...failure], expression };
}

function fenceCode(runner: Runner, { doc, block }: Fence): FenceCode {
  try {
    const code = blockCode(runner, doc, block);
    if (!block.shouldFailToCompile()) return code;
    const start = JSON.stringify(block.details.range.start);
    return runtimeCall(runner, "missingCompileError", JSON.stringify(doc), start);
  } catch (error) {
    if (!(error instanceof DdtCompileError)) throw error;
    if (block.shouldFailToCompile() && error.details.phase === "parse") {
      return { imports: [], expression: asyncFunction([]) };
    }
    return compileErrorCode(runner, doc, error);
  }
}

/** Shift a map of the fence's code to where that code sits in the markdown */
function shiftToFence(mappings: SourceMapSegment[][], { block }: Fence): SourceMapSegment[][] {
  return mappings.map((segments) =>
    segments.map((segment) => {
      if (segment.length === 1) return segment;
      const [column, source, sourceLine, sourceColumn] = segment;
      const position = block.docPosition(sourceLine, sourceColumn);
      return [column, source, position.line - 1, position.column - 1];
    }),
  );
}

export function fenceModule(runner: Runner, fence: Fence): GeneratedModule {
  const { imports, expression } = fenceCode(runner, fence);
  const { open, body, close } = wrap(expression, "export default ", ";");
  const pieces = [...imports, open, ...body, ...(close === "" ? [] : [close])];
  const bundle = new Bundle({ separator: "\n" });
  for (const piece of pieces) {
    if (typeof piece === "string") bundle.addSource(new MagicString(piece));
    else bundle.addSource({ filename: fence.doc, content: piece });
  }
  const { mappings } = bundle.generateDecodedMap({ hires: true });
  const map = new SourceMap({
    sources: [fence.doc],
    names: [],
    mappings: shiftToFence(mappings, fence),
  });
  return { code: bundle.toString(), map };
}

export function docModule(runner: Runner, doc: string, fences: readonly Fence[]): GeneratedModule {
  const lines = [
    runner.testImport,
    `import { loadFences } from '${runner.runtime}';`,
    "const fences = await loadFences([",
    ...fences.map(({ id }) => `  () => import(${JSON.stringify(id)}),`),
    "]);",
  ];
  const mappings: SourceMapSegment[][] = lines.map(() => []);
  for (const [i, { block }] of fences.entries()) {
    const name = JSON.stringify(`${block.details.file}:${block.line}`);
    lines.push(`test(${name}, fences[${i}]);`);
    // Runners locate a test where test() is called, so point the call at its fence
    mappings.push([[0, 0, block.line - 1, block.details.indent]]);
  }
  const map = new SourceMap({ sources: [doc], names: [], mappings });
  return { code: lines.join("\n"), map };
}

export function moduleFiles(runner: Runner, index: DocIndex): Map<string, string> {
  const files = new Map<string, string>();
  for (const [doc, fences] of index.docs()) {
    for (const fence of fences) files.set(fence.id, fenceModule(runner, fence).code);
    files.set(index.docModuleId(doc), docModule(runner, doc, fences).code);
  }
  return files;
}
