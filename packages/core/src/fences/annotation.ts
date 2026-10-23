import { ANNOTATIONS, type Annotation } from "../annotations.ts";

export function isAnnotation(s: unknown): s is Annotation {
  return Object.values(ANNOTATIONS).some((x) => x === s);
}

const FENCE_OPENING = "(?:```|~~~)";
const ANNOTATION = `(?:${Object.values(ANNOTATIONS).join("|")})`;
/** A `&` or `\` that markdown could decode into an annotation, as in `r&#117;n` or `compile\_only` */
const ENCODED = String.raw`[&\\]`;
/** A fence opening line that names an annotation, or may encode one */
const ANNOTATED_FENCE = new RegExp(`${FENCE_OPENING}.*(?:${ANNOTATION}|${ENCODED})`);

/**
 * Whether text may hold a fence to run. A fence's annotations are on its opening line, so
 * text with no such line has none, and parsing it would find nothing
 */
export function mayHaveAnnotatedFence(text: string): boolean {
  return ANNOTATED_FENCE.test(text);
}
