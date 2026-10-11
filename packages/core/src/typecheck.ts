import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import type * as TypeScript from "typescript6";
import { DdtCompileError, type CompileDiagnostic } from "./compile-error.ts";
import { LANGS, type Parser } from "./constants.ts";
import type { Fence } from "./docs.ts";

type CompilerApi = typeof TypeScript;
type NativeApi = typeof import("typescript/unstable/sync");

/** The project's TypeScript: 5 and 6 have the stable compiler API, 7 only an unstable one */
type TypeScriptInstall =
  | { kind: "compiler-api"; version: string; ts: CompilerApi }
  | { kind: "native"; version: string; api: string };

/** A fence's code as checked (its own code, then the runner's globals), by fence id */
type Files = ReadonlyMap<string, string>;
type TypeDiagnostic = { start: number; end: number; message: string };

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
 * Type errors of every TypeScript fence by fence id, checked in memory with the project's
 * TypeScript and tsconfig. Each fence is checked as its own code followed by `globals` (what
 * fences use without importing, like the runner's `expect`), so diagnostic offsets are
 * offsets into the fence and map straight back to the markdown.
 */
export async function typecheck(
  root: string,
  globals: string,
  fences: Iterable<Fence>,
): Promise<Map<string, DdtCompileError>> {
  const typed = [...fences].filter(({ block }) => TYPED_PARSERS.has(LANGS[block.lang].parser));
  if (typed.length === 0) return new Map();

  const install = loadTypeScript(root);
  const files = new Map(typed.map(({ id, block }) => [id, `${block.code}\n${globals}`]));
  const diagnostics =
    install.kind === "compiler-api"
      ? checkWithCompilerApi(install.ts, root, files)
      : await checkWithNativeApi(install.api, root, files);

  const errors = new Map<string, DdtCompileError>();
  for (const fence of typed) {
    const inFence = (diagnostics.get(fence.id) ?? []).filter(
      ({ start }) => start < fence.block.code.length,
    );
    if (inFence.length > 0) errors.set(fence.id, typeError(install.version, fence, inFence));
  }
  return errors;
}

/** The project's own TypeScript, so fences check with the version the project uses */
function loadTypeScript(root: string): TypeScriptInstall {
  const require = createRequire(join(root, "package.json"));
  const requireTypeScript: (id: "typescript") => CompilerApi | { version: string } = require;
  let ts: CompilerApi | { version: string };
  try {
    ts = requireTypeScript("typescript");
  } catch (error) {
    throw new Error('typecheck needs "typescript" installed', { cause: error });
  }
  if ("createProgram" in ts) return { kind: "compiler-api", version: ts.version, ts };
  return { kind: "native", version: ts.version, api: require.resolve("typescript/unstable/sync") };
}

function checkWithCompilerApi(
  ts: CompilerApi,
  root: string,
  files: Files,
): Map<string, TypeDiagnostic[]> {
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
  return new Map(
    [...files.keys()].map((file) => [
      file,
      program
        .getSemanticDiagnostics(program.getSourceFile(file))
        .map(({ start = 0, length = 0, messageText }) => ({
          start,
          end: start + length,
          message: ts.flattenDiagnosticMessageText(messageText, "\n"),
        })),
    ]),
  );
}

function compilerOptions(ts: CompilerApi, root: string): TypeScript.CompilerOptions {
  const configFile = join(root, "tsconfig.json");
  const config: unknown = existsSync(configFile)
    ? ts.readConfigFile(configFile, (file) => ts.sys.readFile(file)).config
    : { compilerOptions: defaultCompilerOptions };
  return { ...ts.parseJsonConfigFileContent(config, ts.sys, root).options, noEmit: true };
}

/** TypeScript 7 checks in a separate process, reading the fences through a virtual file system */
async function checkWithNativeApi(
  api: string,
  root: string,
  files: Files,
): Promise<Map<string, TypeDiagnostic[]>> {
  const [first] = files.keys();
  if (first === undefined) return new Map();
  const config = join(dirname(first), "tsconfig.json");
  const virtual = new Map([...files, [config, JSON.stringify(tsconfig(root, [...files.keys()]))]]);

  const { API }: NativeApi = await import(pathToFileURL(api).href);
  const typescript = new API({
    cwd: root,
    fs: {
      readFile: (file) => virtual.get(file),
      fileExists: (file) => (virtual.has(file) ? true : undefined),
    },
  });
  try {
    const project = typescript.updateSnapshot({ openProjects: [config] }).getProject(config);
    return new Map(
      [...files.keys()].map((file) => [
        file,
        (project?.program.getSemanticDiagnostics(file) ?? []).map(({ pos, end, text }) => ({
          start: pos,
          end,
          message: text,
        })),
      ]),
    );
  } finally {
    typescript.close();
  }
}

function tsconfig(root: string, files: readonly string[]): object {
  const userConfig = join(root, "tsconfig.json");
  if (!existsSync(userConfig)) {
    return { compilerOptions: { ...defaultCompilerOptions, noEmit: true }, files };
  }
  return { extends: userConfig, compilerOptions: { rootDir: root, noEmit: true }, files };
}

function typeError(
  version: string,
  { block }: Fence,
  diagnostics: readonly TypeDiagnostic[],
): DdtCompileError {
  return new DdtCompileError({
    block: block.details,
    parser: { name: LANGS[block.lang].parser, package: "typescript", version },
    phase: "typecheck",
    diagnostics: diagnostics.map(({ start, end, message }): CompileDiagnostic => ({
      message,
      labels: [{ start: block.positionAt(start), end: block.positionAt(end) }],
    })),
  });
}
