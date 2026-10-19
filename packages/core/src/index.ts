export { CodeBlock, parseCodeFences } from "./fences/blocks.ts";
export { defaultDocsInclude, defaultDocsExclude, defaultOutDir } from "./constants.ts";
export { DocIndex, type Fence, type IndexOptions } from "./docs/docs.ts";
export { DdtCompileError } from "./fences/compile-error.ts";
export { resolveLogLevel, type LogLevel } from "./log-level.ts";
export type { DdtOptions } from "./options.ts";
export {
  moduleFiles,
  moduleFor,
  typedImports,
  type GeneratedModule,
  type StaticImport,
  type ModuleSystem,
  type TestAdapter,
} from "./codegen/index.ts";
export { DdtSession } from "./docs/session.ts";
export { findDocs, readDocs, resolveDocsOptions, type DocsOptions } from "./docs/discovery.ts";
