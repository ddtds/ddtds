import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { API, Diagnostic } from "typescript/unstable/sync";
import { DdtCompileError, type CompileDiagnostic } from "./compile-error.ts";
import { LANGS, type Parser } from "./constants.ts";
import type { Fence } from "./docs.ts";

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

const requirePackageJson: (id: string) => { version: string } = createRequire(import.meta.url);

/**
 * Type errors of every TypeScript fence by fence id, checked in memory with TypeScript 7
 * against the project's tsconfig and node_modules. Each fence is checked as its own code
 * followed by `globals` (what fences use without importing, like the runner's `expect`),
 * so diagnostic offsets are offsets into the fence and map straight back to the markdown.
 */
export async function typecheck(
  root: string,
  globals: string,
  fences: Iterable<Fence>,
): Promise<Map<string, DdtCompileError>> {
  const typed = [...fences].filter(({ block }) => TYPED_PARSERS.has(LANGS[block.lang].parser));
  const [first] = typed;
  if (!first) return new Map();

  const files = new Map(typed.map(({ id, block }) => [id, `${block.code}\n${globals}`]));
  const config = join(dirname(first.id), "tsconfig.json");
  files.set(config, JSON.stringify(tsconfig(root, typed)));

  const api = await startTypeScript(root, files);
  try {
    const { program } = api.updateSnapshot({ openProjects: [config] }).getProject(config) ?? {};
    const errors = new Map<string, DdtCompileError>();
    for (const fence of typed) {
      const diagnostics = program?.getSemanticDiagnostics(fence.id) ?? [];
      const inFence = diagnostics.filter(({ pos }) => pos < fence.block.code.length);
      if (inFence.length > 0) errors.set(fence.id, typeError(fence, inFence));
    }
    return errors;
  } finally {
    api.close();
  }
}

function tsconfig(root: string, fences: readonly Fence[]): object {
  const files = fences.map(({ id }) => id);
  const userConfig = join(root, "tsconfig.json");
  if (!existsSync(userConfig)) {
    return { compilerOptions: { ...defaultCompilerOptions, noEmit: true }, files };
  }
  return { extends: userConfig, compilerOptions: { rootDir: root, noEmit: true }, files };
}

async function startTypeScript(root: string, files: ReadonlyMap<string, string>): Promise<API> {
  const { API } = await import("typescript/unstable/sync").catch((error: unknown) => {
    throw new Error('typecheck needs "typescript" 7 installed', { cause: error });
  });
  return new API({
    cwd: root,
    fs: {
      readFile: (file) => files.get(file),
      fileExists: (file) => (files.has(file) ? true : undefined),
    },
  });
}

function typeError({ block }: Fence, diagnostics: readonly Diagnostic[]): DdtCompileError {
  const version = requirePackageJson("typescript/package.json").version;
  return new DdtCompileError({
    block: block.details,
    parser: { name: LANGS[block.lang].parser, package: "typescript", version },
    phase: "typecheck",
    diagnostics: diagnostics.map(({ pos, end, text }): CompileDiagnostic => ({
      message: text,
      labels: [{ start: block.positionAt(pos), end: block.positionAt(end) }],
    })),
  });
}
