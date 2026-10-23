import { ANNOTATIONS, type Annotation } from "../annotations.ts";

export function isAnnotation(s: unknown): s is Annotation {
  return Object.values(ANNOTATIONS).some((x) => x === s);
}

/**
 * A fence opening line that names an annotation, or has a `&` or `\` that markdown could
 * decode into one, as in `r&#117;n` or `compile\_only`
 */
const ANNOTATED_FENCE = /(?:```|~~~).*(?:skip|run|fail|compile_only|[&\\])/;

/**
 * Whether text may hold a fence to run. A fence's annotations are on its opening line, so
 * text with no such line has none, and parsing it would find nothing
 */
export function mayHaveAnnotatedFence(text: string): boolean {
  return ANNOTATED_FENCE.test(text);
}
