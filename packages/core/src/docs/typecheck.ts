import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type * as TypeScript from "typescript6";
import { DdtCompileError, type CompileDiagnostic } from "../fences/compile-error.ts";
import { parserOf, type Parser } from "../constants.ts";
import type { TestAdapter } from "../codegen/adapter.ts";
import { renderImport, runtimeNames, unshadowed } from "../codegen/static-import.ts";
import type { DocIndex, Fence } from "./docs.ts";

type CompilerApi = typeof TypeScript;

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
 * One checker serves a whole watch session through a language service, which reuses parsed files
 * and unchanged fences between checks. TypeScript and the tsconfig are read once per checker.
 */
export class TypeChecker {
  readonly #root: string;
  readonly #tsconfig: string;
  readonly #adapter: TestAdapter;
  /** Source of each fence being checked by id, which doubles as its version */
  readonly #sources = new Map<string, string>();
  #compiler: { ts: CompilerApi; service: TypeScript.LanguageService } | undefined;

  public constructor(root: string, adapter: TestAdapter) {
    this.#tsconfig = join(root, "tsconfig.json");
    this.#root = root;
    this.#adapter = adapter;
  }

  public check(index: DocIndex): Map<string, DdtCompileError> {
    const typed = [...index.fences()].filter(({ block }) =>
      TYPED_PARSERS.has(parserOf(block.lang)),
    );
    this.#sources.clear();
    for (const fence of typed) this.#sources.set(fence.id, fenceSource(fence, this.#adapter));
    if (typed.length === 0) return new Map();

    const { ts, service } = this.#load();
    const errors = new Map<string, DdtCompileError>();
    for (const fence of typed) {
      const diagnostics = service
        .getSemanticDiagnostics(fence.id)
        .filter(({ start = 0 }) => start < fence.block.code.length);
      if (diagnostics.length > 0) errors.set(fence.id, typeError(ts, fence, diagnostics));
    }
    return errors;
  }

  #load(): { ts: CompilerApi; service: TypeScript.LanguageService } {
    if (this.#compiler === undefined) {
      const ts = loadTypeScript(this.#root);
      const options = compilerOptions(ts, this.#tsconfig);
      const sources = this.#sources;
      const host: TypeScript.LanguageServiceHost = {
        ...ts.sys,
        useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
        getCompilationSettings: () => options,
        getCurrentDirectory: () => this.#root,
        getDefaultLibFileName: ts.getDefaultLibFilePath,
        getScriptFileNames: () => [...sources.keys()],
        getScriptVersion: (file) => sources.get(file) ?? versionOf(ts, file),
        getScriptSnapshot: (file) => {
          const text = sources.get(file) ?? ts.sys.readFile(file);
          return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
        },
        fileExists: (file) => sources.has(file) || ts.sys.fileExists(file),
        readFile: (file) => sources.get(file) ?? ts.sys.readFile(file),
      };
      this.#compiler = { ts, service: ts.createLanguageService(host) };
    }
    return this.#compiler;
  }
}

/** A project file's version is its mtime; installed packages do not change within a session */
const versionOf = (ts: CompilerApi, file: string): string =>
  file.includes("/node_modules/") ? "" : String(ts.sys.getModifiedTime?.(file)?.getTime());

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
  ts: CompilerApi,
  { block }: Fence,
  diagnostics: readonly TypeScript.Diagnostic[],
): DdtCompileError {
  return new DdtCompileError({
    block: block.details,
    parser: { name: parserOf(block.lang), package: "typescript", version: ts.version },
    phase: "typecheck",
    diagnostics: diagnostics.map(({ start = 0, length = 0, messageText }): CompileDiagnostic => ({
      message: ts.flattenDiagnosticMessageText(messageText, "\n"),
      labels: [{ start: block.positionAt(start), end: block.positionAt(start + length) }],
    })),
  });
}
