export const defaultDocsInclude: string[] = ["**/*.{md,mdx}"];
export const defaultDocsExclude: string[] = ["**/node_modules/**", "**/CHANGELOG.md"];
export const defaultOutDir = "__doctests__";

const PARSERS = ["ts", "js", "tsx", "jsx", "tsrx"] as const;
/** The parser that reads a fence. */
export type Parser = (typeof PARSERS)[number];

const OUTPUT_EXTENSIONS = ["ts", "tsx", "tsrx"] as const;
/** The extension of a generated fence module. */
export type OutputExtension = (typeof OUTPUT_EXTENSIONS)[number];

/** Code fence languages, the parser for each, and the extension of its generated test file. */
const LANGS = {
  ts: { parser: "ts", extension: "ts" },
  typescript: { parser: "ts", extension: "ts" },
  js: { parser: "js", extension: "ts" },
  javascript: { parser: "js", extension: "ts" },
  tsx: { parser: "tsx", extension: "tsx" },
  jsx: { parser: "jsx", extension: "tsx" },
  tsrx: { parser: "tsrx", extension: "tsrx" },
} as const;

/** A code fence language that ddtds runs. */
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

export const ANNOTATIONS = {
  SKIP: "skip",
  RUN: "run",
  FAIL: "fail",
  COMPILE_FAIL: "compile_fail",
} as const;

/** What a fence's meta asks for: skip it, run it, expect it to fail, or expect it not to compile. */
export type Annotation = (typeof ANNOTATIONS)[keyof typeof ANNOTATIONS];

export function isAnnotation(s: unknown): s is Annotation {
  return Object.values(ANNOTATIONS).some((x) => x === s);
}
