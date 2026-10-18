/**
 * Turn a title into a URL slug.
 *
 * ```js run
 * const { slugify } = require("@ddtds/example-mocha-cjs");
 *
 * assert.equal(slugify("Hello, World!"), "hello-world");
 * ```
 *
 * Fences in comments run like fences in markdown:
 *
 * ```js fail
 * const { slugify } = require("@ddtds/example-mocha-cjs");
 *
 * assert.equal(slugify("Hello, World!"), "Hello, World!");
 * ```
 */
function slugify(title) {
  return title
    .toLowerCase()
    .trim()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");
}

module.exports = { slugify };
