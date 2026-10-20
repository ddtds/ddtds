export const ANNOTATIONS = {
  SKIP: "skip",
  RUN: "run",
  FAIL: "fail",
  COMPILE_FAIL: "compile_fail",
  COMPILE_ONLY: "compile_only",
} as const;

export type Annotation = (typeof ANNOTATIONS)[keyof typeof ANNOTATIONS];
