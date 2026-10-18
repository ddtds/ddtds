/**
 * Turn a title into a URL slug.
 *
 * ```ts run
 * import { slugify } from "@ddtds/example-mocha";
 *
 * assert.equal(slugify("Hello, World!"), "hello-world");
 * ```
 *
 * Fences in comments run like fences in markdown:
 *
 * ```ts fail
 * import { slugify } from "@ddtds/example-mocha";
 *
 * assert.equal(slugify("Hello, World!"), "Hello, World!");
 * ```
 */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");
}
