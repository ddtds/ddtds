import type { ModuleSystem } from "./codegen/adapter.ts";
import { DOC_GLOB } from "./fences/doc-kinds.ts";

/** Markdown docs, and source files whose JSDoc comments hold code fences */
export const defaultDocsInclude: string[] = [DOC_GLOB];
export const defaultDocsExclude: string[] = [
  "**/node_modules/**",
  "**/CHANGELOG.md",
  "**/dist/**",
  "**/*.d.ts",
  "**/__ddtds__/**",
];
export const defaultOutDir = "__doctests__";

const PARSERS = ["ts", "js", "tsx", "jsx", "tsrx"] as const;
export type Parser = (typeof PARSERS)[number];

const OUTPUT_EXTENSIONS = ["ts", "tsx", "tsrx"] as const;
export type OutputExtension = (typeof OUTPUT_EXTENSIONS)[number];

type LangInfo = { parser: Parser; extension: OutputExtension; module?: ModuleSystem };

/** Code fence languages, the parser for each, and the extension of its generated test file. */
const LANGS = {
  ts: { parser: "ts", extension: "ts" },
  typescript: { parser: "ts", extension: "ts" },
  js: { parser: "js", extension: "ts" },
  javascript: { parser: "js", extension: "ts" },
  tsx: { parser: "tsx", extension: "tsx" },
  jsx: { parser: "jsx", extension: "tsx" },
  tsrx: { parser: "tsrx", extension: "tsrx" },
  mjs: { parser: "js", extension: "ts", module: "esm" },
  mts: { parser: "ts", extension: "ts", module: "esm" },
  cjs: { parser: "js", extension: "ts", module: "cjs" },
  cts: { parser: "ts", extension: "ts", module: "cjs" },
} as const;

export type Lang = keyof typeof LANGS;

export function isLang(s: string): s is Lang {
  return Object.hasOwn(LANGS, s);
}

export function parserOf(lang: Lang): Parser {
  return LANGS[lang].parser;
}

export function extensionOf(lang: Lang): OutputExtension {
  return LANGS[lang].extension;
}

export function moduleOfLang(lang: Lang): ModuleSystem | undefined {
  const entry: LangInfo = LANGS[lang];
  return entry.module;
}

export function moduleOfPath(path: string): ModuleSystem | undefined {
  if (/\.m[jt]s$/.test(path)) return "esm";
  if (/\.c[jt]s$/.test(path)) return "cjs";
  return undefined;
}

export const ANNOTATIONS = {
  SKIP: "skip",
  RUN: "run",
  FAIL: "fail",
  COMPILE_FAIL: "compile_fail",
} as const;

export type Annotation = (typeof ANNOTATIONS)[keyof typeof ANNOTATIONS];

export function isAnnotation(s: unknown): s is Annotation {
  return Object.values(ANNOTATIONS).some((x) => x === s);
}
