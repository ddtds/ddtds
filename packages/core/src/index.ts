import { mkdirSync, rmSync, writeFileSync } from "node:fs";

export { CodeBlock, parseCodeFences } from "./fences/blocks.ts";
export { defaultDocsInclude, defaultDocsExclude, defaultOutDir } from "./constants.ts";
export { DocIndex, type Fence, type IndexOptions } from "./docs/docs.ts";
export { DdtCompileError } from "./fences/compile-error.ts";
export { resolveLogLevel, type LogLevel } from "./log-level.ts";
export {
  moduleFiles,
  moduleFor,
  typedImports,
  type GeneratedModule,
  type TestAdapter,
} from "./codegen/index.ts";
export { DdtSession } from "./docs/session.ts";
export { findDocs, readDocs, resolveDocsOptions, type DocsOptions } from "./docs/discovery.ts";

export function writeFiles(dir: string, files: ReadonlyMap<string, string>): void {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const [path, content] of files) writeFileSync(path, content);
}
