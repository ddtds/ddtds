/** Markdown docs, and source files whose JSDoc comments hold code fences */
export const defaultDocsInclude: string[] = ["**/*.{md,mdx,ts,tsx,js,jsx,mts,cts,mjs,cjs}"];
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

export type Annotation = (typeof ANNOTATIONS)[keyof typeof ANNOTATIONS];

export function isAnnotation(s: unknown): s is Annotation {
  return Object.values(ANNOTATIONS).some((x) => x === s);
}
