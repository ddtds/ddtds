/**
 * Turn a title into a URL slug.
 *
 * ```ts run
 * import { slugify } from "@ddtds/example-node";
 *
 * assert.equal(slugify("Hello, World!"), "hello-world");
 * ```
 *
 * Fences in comments run like fences in markdown:
 *
 * ```ts fail
 * import { slugify } from "@ddtds/example-node";
 *
 * assert.equal(slugify("Hello, World!"), "Hello, World!");
 * ```
 *
 * Setup comments work here too:
 *
 * <!-- ddt-setup import { slugify } from "@ddtds/example-node"; -->
 *
 * ```ts run
 * assert.equal(slugify("In JSDoc"), "in-jsdoc");
 * ```
 */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");
}
