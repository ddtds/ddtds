import { ANNOTATIONS, type Annotation } from "../annotations.ts";

export function isAnnotation(s: unknown): s is Annotation {
  return Object.values(ANNOTATIONS).some((x) => x === s);
}

const FENCE_OPENING = "(?:```|~~~)";
const ANNOTATION = `(?:${Object.values(ANNOTATIONS).join("|")})`;
const ANNOTATED_FENCE = new RegExp(`${FENCE_OPENING}.*${ANNOTATION}`);

/**
 * Whether text may hold a fence to run. A fence's annotations are on its opening line, so
 * text with no such line has none, and parsing it would find nothing
 */
export function mayHaveAnnotatedFence(text: string): boolean {
  return ANNOTATED_FENCE.test(text);
}
