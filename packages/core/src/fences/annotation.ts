import { ANNOTATIONS, type Annotation } from "../annotations.ts";

export function isAnnotation(s: unknown): s is Annotation {
  return Object.values(ANNOTATIONS).some((x) => x === s);
}

const FENCE_OPENING = "(?:```|~~~)";
const ANNOTATION = `(?:${Object.values(ANNOTATIONS).join("|")})`;
/** Annotations sit on a fence's opening line, so text without a match has no fence to run */
export const ANNOTATED_FENCE = new RegExp(`${FENCE_OPENING}.*${ANNOTATION}`);
