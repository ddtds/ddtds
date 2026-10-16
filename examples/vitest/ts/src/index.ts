/**
 * Joins words with a single space.
 *
 * ```ts run
 * import { join } from "@ddtds/example-ts";
 *
 * expect(join(["hello", "world"])).toBe("hello world");
 * ```
 *
 * No words give an empty string:
 *
 * ```ts run
 * import { join } from "@ddtds/example-ts";
 *
 * expect(join([])).toBe("");
 * ```
 */
export function join(words: string[]): string {
  return words.join(" ");
}
