import { existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type * as TypeScript from "typescript6";
import { DdtCompileError, type CompileDiagnostic } from "../fences/compile-error.ts";
import { parserOf, type Parser } from "../constants.ts";
import type { TestAdapter } from "../codegen/adapter.ts";
import { renderImport, runtimeNames, unshadowed } from "../codegen/static-import.ts";
import type { DocIndex, Fence } from "./docs.ts";

type CompilerApi = typeof TypeScript;
type TypeDiagnostic = { start: number; end: number; message: string };

/** What was last checked for a fence: its code, the program input, and the result */
type CheckedFence = {
  code: string;
  source: string;
  file?: TypeScript.SourceFile;
  diagnostics?: TypeDiagnostic[];
};

const TYPED_PARSERS: ReadonlySet<Parser> = new Set(["ts", "tsx"]);

/** Used when the project has no tsconfig.json */
const defaultCompilerOptions = {
  strict: true,
  target: "esnext",
  module: "preserve",
  moduleResolution: "bundler",
  jsx: "react-jsx",
  skipLibCheck: true,
};

/**
 * Type errors of every TypeScript fence, checked in memory with the project's TypeScript and
 * tsconfig. Each fence is checked as its own code followed by the adapter's fence imports (what
 * fences use without importing, like `expect`), so diagnostic offsets are offsets into the fence
 * and map straight back to the markdown. `export {}` makes each fence a module, so fences do not
 * share declarations.
 *
 * One checker serves a whole watch session. Fences are isolated modules, so a fence whose code is
 * unchanged keeps its diagnostics, and parsed library files and unchanged fences are reused.
 * TypeScript and the tsconfig are read once per checker.
 */
export class TypeChecker {
  readonly #root: string;
  readonly #tsconfig: string;
  readonly #adapter: TestAdapter;
  readonly #fences = new Map<string, CheckedFence>();
  readonly #byFileName = new Map<string, CheckedFence>();
  readonly #parsedFiles = new Map<string, { file: TypeScript.SourceFile; modified?: number }>();
  /** Counts project files that changed on disk, which can change any fence's result */
  #changes = 0;
  #compiler: { ts: CompilerApi; options: TypeScript.CompilerOptions } | undefined;
  #program: TypeScript.Program | undefined;

  public constructor(root: string, adapter: TestAdapter) {
    this.#tsconfig = join(root, "tsconfig.json");
    this.#root = root;
    this.#adapter = adapter;
  }

  public check(index: DocIndex): Map<string, DdtCompileError> {
    const fences = [...index.fences()];
    if (fences.length === 0) {
      this.#fences.clear();
      return new Map();
    }
    const { ts, options } = this.#load();
    const typed = fences.filter(({ block }) => TYPED_PARSERS.has(parserOf(block.lang)));
    const typedIds = new Set(typed.map(({ id }) => id));
    for (const id of this.#fences.keys()) if (!typedIds.has(id)) this.#fences.delete(id);
    if (typed.length === 0) return new Map();

    this.#byFileName.clear();
    for (const fence of typed) {
      const { code } = fence.block;
      let checked = this.#fences.get(fence.id);
      if (checked?.code !== code) {
        checked = { code, source: fenceSource(fence, this.#adapter) };
        this.#fences.set(fence.id, checked);
      }
      this.#byFileName.set(fence.id, checked);
    }
    const changesBefore = this.#changes;
    const program = this.#createProgram(ts, options);
    if (this.#changes !== changesBefore)
      for (const checked of this.#fences.values()) checked.diagnostics = undefined;

    const errors = new Map<string, DdtCompileError>();
    for (const fence of typed) {
      const checked = this.#fences.get(fence.id);
      if (checked === undefined) continue;
      checked.diagnostics ??= diagnosticsOf(ts, program, fence.id);
      const inFence = checked.diagnostics.filter(({ start }) => start < fence.block.code.length);
      if (inFence.length > 0) errors.set(fence.id, typeError(ts.version, fence, inFence));
    }
    return errors;
  }

  /** A file's parsed source, reused until a project file changes on disk */
  #parsed(
    base: TypeScript.CompilerHost,
    args: Parameters<TypeScript.CompilerHost["getSourceFile"]>,
  ): TypeScript.SourceFile | undefined {
    const [file] = args;
    const cached = this.#parsedFiles.get(file);
    const modified = file.includes("/node_modules/") ? undefined : mtimeOf(file);
    if (cached !== undefined && cached.modified === modified) return cached.file;
    const parsed = base.getSourceFile(...args);
    if (cached !== undefined) this.#changes += 1;
    if (parsed === undefined) this.#parsedFiles.delete(file);
    else this.#parsedFiles.set(file, { file: parsed, modified });
    return parsed;
  }

  #createProgram(ts: CompilerApi, options: TypeScript.CompilerOptions): TypeScript.Program {
    const base = ts.createCompilerHost(options);
    const host: TypeScript.CompilerHost = {
      ...base,
      getSourceFile: (file, language, ...rest) => {
        const checked = this.#byFileName.get(file);
        if (checked !== undefined)
          return (checked.file ??= ts.createSourceFile(file, checked.source, language));
        return this.#parsed(base, [file, language, ...rest]);
      },
      fileExists: (file) => this.#byFileName.has(file) || base.fileExists(file),
      readFile: (file) => this.#byFileName.get(file)?.source ?? base.readFile(file),
    };
    this.#program = ts.createProgram({
      rootNames: [...this.#byFileName.keys()],
      options,
      host,
      oldProgram: this.#program,
    });
    return this.#program;
  }

  #load(): { ts: CompilerApi; options: TypeScript.CompilerOptions } {
    if (this.#compiler === undefined) {
      const ts = loadTypeScript(this.#root);
      this.#compiler = { ts, options: compilerOptions(ts, this.#tsconfig) };
    }
    return this.#compiler;
  }
}

function diagnosticsOf(
  ts: CompilerApi,
  program: TypeScript.Program,
  file: string,
): TypeDiagnostic[] {
  return program
    .getSemanticDiagnostics(program.getSourceFile(file))
    .map(({ start = 0, length = 0, messageText }) => ({
      start,
      end: start + length,
      message: ts.flattenDiagnosticMessageText(messageText, "\n"),
    }));
}

/** A fence's code, then the adapter's fence imports it does not already import itself */
function fenceSource({ block }: Fence, adapter: TestAdapter): string {
  let taken: string[] = [];
  try {
    taken = runtimeNames(block.splitImports().bindings);
  } catch {
    // a fence that does not parse reports its own error
  }
  const globals = unshadowed(adapter.fenceImports, taken).map((fenceImport) =>
    renderImport(fenceImport, "esm"),
  );
  return [block.code, "export {};", ...globals].join("\n");
}

/** The project's own TypeScript, so fences check with the version the project uses */
function loadTypeScript(root: string): CompilerApi {
  const require = createRequire(join(root, "package.json"));
  const requireTypeScript: (id: "typescript") => CompilerApi | { version: string } = require;
  let ts: CompilerApi | { version: string };
  try {
    ts = requireTypeScript("typescript");
  } catch (error) {
    throw new Error('typecheck needs "typescript" installed', { cause: error });
  }
  if (!("createProgram" in ts)) {
    throw new Error(`typecheck supports TypeScript 5 and 6, found ${ts.version}`);
  }
  return ts;
}

function mtimeOf(file: string): number | undefined {
  try {
    return statSync(file).mtimeMs;
  } catch {
    return undefined;
  }
}

function compilerOptions(ts: CompilerApi, configFile: string): TypeScript.CompilerOptions {
  const config: unknown = existsSync(configFile)
    ? ts.readConfigFile(configFile, (file) => ts.sys.readFile(file)).config
    : { compilerOptions: defaultCompilerOptions };
  return {
    ...ts.parseJsonConfigFileContent(config, ts.sys, dirname(configFile)).options,
    noEmit: true,
  };
}

function typeError(
  version: string,
  { block }: Fence,
  diagnostics: readonly TypeDiagnostic[],
): DdtCompileError {
  return new DdtCompileError({
    block: block.details,
    parser: { name: parserOf(block.lang), package: "typescript", version },
    phase: "typecheck",
    diagnostics: diagnostics.map(({ start, end, message }): CompileDiagnostic => ({
      message,
      labels: [{ start: block.positionAt(start), end: block.positionAt(end) }],
    })),
  });
}
