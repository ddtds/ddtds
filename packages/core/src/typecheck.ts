import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import type * as TypeScript from "typescript6";
import { DdtCompileError, type CompileDiagnostic } from "./compile-error.ts";
import { LANGS, type Parser } from "./constants.ts";
import type { Fence } from "./docs.ts";

type TS = typeof TypeScript;

const TYPED_PARSERS: ReadonlySet<Parser> = new Set(["ts", "tsx"]);

/**
 * Type errors of every TypeScript fence by fence id, checked in memory with the project's
 * TypeScript (5 or 6, for its stable compiler API) and tsconfig. Each fence is checked as its
 * own code followed by `globals` (what fences use without importing, like the runner's
 * `expect`), so diagnostic offsets are offsets into the fence and map straight back to the
 * markdown.
 */
export function typecheck(
  root: string,
  globals: string,
  fences: Iterable<Fence>,
): Map<string, DdtCompileError> {
  const typed = [...fences].filter(({ block }) => TYPED_PARSERS.has(LANGS[block.lang].parser));
  if (typed.length === 0) return new Map();

  const ts = loadTypeScript(root);
  const files = new Map(typed.map(({ id, block }) => [id, `${block.code}\n${globals}`]));
  const options = compilerOptions(ts, root);
  const base = ts.createCompilerHost(options);
  const host: TypeScript.CompilerHost = {
    ...base,
    getSourceFile: (file, language, ...rest) => {
      const source = files.get(file);
      if (source === undefined) return base.getSourceFile(file, language, ...rest);
      return ts.createSourceFile(file, source, language);
    },
    fileExists: (file) => files.has(file) || base.fileExists(file),
    readFile: (file) => files.get(file) ?? base.readFile(file),
  };

  const program = ts.createProgram({ rootNames: [...files.keys()], options, host });
  const errors = new Map<string, DdtCompileError>();
  for (const fence of typed) {
    const diagnostics = program.getSemanticDiagnostics(program.getSourceFile(fence.id));
    const inFence = diagnostics.filter(({ start = 0 }) => start < fence.block.code.length);
    if (inFence.length > 0) errors.set(fence.id, typeError(ts, fence, inFence));
  }
  return errors;
}

/** The project's own TypeScript, so fences check with the version the project uses */
function loadTypeScript(root: string): TS {
  const requireTypeScript: (id: "typescript") => TS = createRequire(join(root, "package.json"));
  let ts: TS;
  try {
    ts = requireTypeScript("typescript");
  } catch (error) {
    throw new Error('typecheck needs "typescript" installed', { cause: error });
  }
  if (typeof ts.createProgram !== "function") {
    throw new Error(`typecheck needs TypeScript 5 or 6 for its compiler API, found ${ts.version}`);
  }
  return ts;
}

function compilerOptions(ts: TS, root: string): TypeScript.CompilerOptions {
  const configFile = join(root, "tsconfig.json");
  if (!existsSync(configFile)) {
    return {
      strict: true,
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.Preserve,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX,
      skipLibCheck: true,
      noEmit: true,
    };
  }
  const { config } = ts.readConfigFile(configFile, (file) => ts.sys.readFile(file));
  return { ...ts.parseJsonConfigFileContent(config, ts.sys, root).options, noEmit: true };
}

function typeError(
  ts: TS,
  { block }: Fence,
  diagnostics: readonly TypeScript.Diagnostic[],
): DdtCompileError {
  return new DdtCompileError({
    block: block.details,
    parser: { name: LANGS[block.lang].parser, package: "typescript", version: ts.version },
    phase: "typecheck",
    diagnostics: diagnostics.map(({ start = 0, length = 0, messageText }): CompileDiagnostic => ({
      message: ts.flattenDiagnosticMessageText(messageText, "\n"),
      labels: [{ start: block.positionAt(start), end: block.positionAt(start + length) }],
    })),
  });
}
