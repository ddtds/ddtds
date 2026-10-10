export const defaultDocsInclude = ["**/*.{md,mdx}"];
export const defaultDocsExclude = ["**/node_modules/**", "**/CHANGELOG.md"];
export const defaultOutputDir = "__doctests__";

const PARSERS = ["ts", "js", "tsx", "jsx", "tsrx"] as const;
export type Parser = (typeof PARSERS)[number];

export const OUTPUT_EXTENSIONS = ["ts", "tsx", "tsrx"] as const;
export type OutputExtension = (typeof OUTPUT_EXTENSIONS)[number];

/** Code fence languages, the parser for each, and the extension of its generated test file. */
export const LANGS = {
  ts: { parser: "ts", extension: "ts" },
  typescript: { parser: "ts", extension: "ts" },
  js: { parser: "js", extension: "ts" },
  javascript: { parser: "js", extension: "ts" },
  tsx: { parser: "tsx", extension: "tsx" },
  jsx: { parser: "jsx", extension: "tsx" },
  tsrx: { parser: "tsrx", extension: "tsrx" },
} as const satisfies Record<string, { parser: Parser; extension: OutputExtension }>;

export type Lang = keyof typeof LANGS;

export const SUPPORTED_LANGS: ReadonlySet<string> = new Set(Object.keys(LANGS));

export function isLang(s: string): s is Lang {
  return SUPPORTED_LANGS.has(s);
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
