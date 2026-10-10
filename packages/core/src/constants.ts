export const defaultDocsInclude = ["**/*.{md,mdx}"];
export const defaultDocsExclude = ["**/node_modules/**", "**/CHANGELOG.md"];
export const defaultOutputDir = "__doctests__";

export const SUPPORTED_LANGS = new Set([
  "ts",
  "typescript",
  "tsx",
  "tsrx",
  "jsx",
  "js",
  "javascript",
]);

export const ANNOTATIONS = {
  SKIP: "skip",
  RUN: "run",
  FAIL: "fail",
} as const;

export type Annotation = (typeof ANNOTATIONS)[keyof typeof ANNOTATIONS];

export function isAnnotation(s: unknown): s is Annotation {
  return Object.values(ANNOTATIONS).some((x) => x === s);
}
