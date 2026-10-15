import { mkdirSync, rmSync, writeFileSync } from "node:fs";

export { CodeBlock, parseCodeFences } from "./blocks.ts";
export {
  type Lang,
  ANNOTATIONS,
  type Annotation,
  defaultDocsInclude,
  defaultDocsExclude,
  defaultOutDir,
} from "./constants.ts";
export { DocIndex, type Fence, type IndexOptions } from "./docs.ts";
export { isSourceFile } from "./doc-kinds.ts";
export { parseJsDocFences } from "./jsdoc.ts";
export {
  DdtCompileError,
  type CompileDiagnostic,
  type CompileErrorDetails,
  type CompileLabel,
  type Position,
} from "./compile-error.ts";
export { resolveLogLevel, type LogLevel } from "./log-level.ts";
export {
  moduleFiles,
  moduleFor,
  sourceTests,
  typedImports,
  type GeneratedModule,
  type TestAdapter,
} from "./codegen/index.ts";
export { DdtSession } from "./session.ts";
export {
  findDocs,
  readDocs,
  resolveDocsOptions,
  type DocsConfig,
  type DocsOptions,
} from "./discovery.ts";

export function writeFiles(dir: string, files: ReadonlyMap<string, string>): void {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const [path, content] of files) writeFileSync(path, content);
}
