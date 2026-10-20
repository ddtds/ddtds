import { ANNOTATIONS, type Annotation } from "../annotations.ts";

export function isAnnotation(s: unknown): s is Annotation {
  return Object.values(ANNOTATIONS).some((x) => x === s);
}
