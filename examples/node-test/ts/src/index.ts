/**
 * Turns a title into a lowercase, dash-separated slug.
 *
 * ```ts run
 * import { slugify } from "@ddtds/example-node";
 *
 * assert.equal(slugify("Hello, World!"), "hello-world");
 * ```
 *
 * Leading and trailing separators are dropped:
 *
 * ```ts run
 * import { slugify } from "@ddtds/example-node";
 *
 * assert.equal(slugify("  Getting Started "), "getting-started");
 * ```
 */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");
}
