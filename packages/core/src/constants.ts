export const defaultDocsInclude = ["**/*.{md,mdx}"];
export const defaultDocsExclude = ["**/node_modules/**", "**/CHANGELOG.md"];
export const defaultOutputDir = "__doctests__";

/** Code fence languages, the oxc parser for each, and the extension of its generated test file. */
export const LANGS = {
  ts: { parser: "ts", extension: "ts" },
  typescript: { parser: "ts", extension: "ts" },
  js: { parser: "js", extension: "ts" },
  javascript: { parser: "js", extension: "ts" },
  tsx: { parser: "tsx", extension: "tsx" },
  jsx: { parser: "jsx", extension: "tsx" },
  tsrx: { parser: "tsrx", extension: "tsrx" },
} as const;

export type Lang = keyof typeof LANGS;
export type OutputExtension = (typeof LANGS)[Lang]["extension"];

export const SUPPORTED_LANGS: ReadonlySet<string> = new Set(Object.keys(LANGS));
export const OUTPUT_EXTENSIONS: OutputExtension[] = [
  ...new Set(Object.values(LANGS).map((lang) => lang.extension)),
];

export function isLang(s: string): s is Lang {
  return SUPPORTED_LANGS.has(s);
}

export const ANNOTATIONS = {
  SKIP: "skip",
  RUN: "run",
  FAIL: "fail",
} as const;

export type Annotation = (typeof ANNOTATIONS)[keyof typeof ANNOTATIONS];

export function isAnnotation(s: unknown): s is Annotation {
  return Object.values(ANNOTATIONS).some((x) => x === s);
}
