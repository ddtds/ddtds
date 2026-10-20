import { createRequire } from "node:module";
import { join } from "node:path";
import type * as TypeScript from "typescript6";
import { DdtCompileError, type CompileDiagnostic } from "../fences/compile-error.ts";
import { parserOf } from "../language-registry.ts";
import type { Parser } from "../languages.ts";
import { splitImportsAndBlock } from "../fences/parse.ts";
import type { TestAdapter } from "../codegen/adapter.ts";
import { renderImport, runtimeNames, unshadowed } from "../codegen/static-import.ts";
import type { DocIndex, Fence } from "./docs.ts";

type CompilerApi = typeof TypeScript;
type Compiler = { ts: CompilerApi; service: TypeScript.LanguageService };

const TYPED_PARSERS: ReadonlySet<Parser> = new Set(["ts", "tsx"]);

export class TypeChecker {
  readonly #root: string;
  readonly #adapter: TestAdapter;
  readonly #sources = new Map<string, string>();
  #compiler: Compiler | undefined;

  public constructor(root: string, adapter: TestAdapter) {
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

  #load(): Compiler {
    if (this.#compiler === undefined) {
      const ts = loadTypeScript(this.#root);
      this.#compiler = { ts, service: createService(ts, this.#root, this.#sources) };
    }
    return this.#compiler;
  }
}

function createService(
  ts: CompilerApi,
  root: string,
  sources: ReadonlyMap<string, string>,
): TypeScript.LanguageService {
  const options = compilerOptions(ts, root);
  return ts.createLanguageService({
    ...ts.sys,
    useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
    getCompilationSettings: () => options,
    getCurrentDirectory: () => root,
    getDefaultLibFileName: ts.getDefaultLibFilePath,
    getScriptFileNames: () => [...sources.keys()],
    getScriptVersion: (file) => sources.get(file) ?? versionOf(ts, file),
    getScriptSnapshot: (file) => {
      const text = sources.get(file) ?? ts.sys.readFile(file);
      return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
    },
  });
}

const versionOf = (ts: CompilerApi, file: string): string =>
  file.includes("/node_modules/") ? "" : String(ts.sys.getModifiedTime?.(file)?.getTime());

function fenceSource({ block }: Fence, adapter: TestAdapter): string {
  let taken: string[] = [];
  try {
    taken = runtimeNames(splitImportsAndBlock(block).bindings);
  } catch {}
  const globals = unshadowed(adapter.fenceImports, taken).map((fenceImport) =>
    renderImport(fenceImport, "esm"),
  );
  return [block.code, "export {};", ...globals].join("\n");
}

function loadTypeScript(root: string): CompilerApi {
  const require = createRequire(join(root, "package.json"));
  const requireTypeScript: (id: "typescript") => CompilerApi = require;
  try {
    return requireTypeScript("typescript");
  } catch (error) {
    throw new Error('typecheck needs "typescript" installed', { cause: error });
  }
}

function compilerOptions(ts: CompilerApi, root: string): TypeScript.CompilerOptions {
  const configFile = ts.findConfigFile(root, (file) => ts.sys.fileExists(file));
  if (configFile === undefined) throw new Error(`typecheck needs a tsconfig.json in ${root}`);
  const config = ts.getParsedCommandLineOfConfigFile(
    configFile,
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: () => {},
    },
  );
  return { ...config?.options, noEmit: true };
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
