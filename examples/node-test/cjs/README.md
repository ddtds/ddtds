# Node CommonJS Example

Fences run with `node --test`, asserting with the strict `assert` from `node:assert`. This package is
CommonJS, so fences use `require`:

```js run
const { slugify } = require("@ddtds/example-node-cjs");

assert.equal(slugify("Hello, World!"), "hello-world");
```

Types are stripped by Node, so fences can be TypeScript:

```ts run
const { slugify } = require("@ddtds/example-node-cjs");

const titles: string[] = ["  Getting Started ", "API & Usage"];
assert.deepEqual(titles.map(slugify), ["getting-started", "api-usage"]);
```

A `fail` fence passes only when it throws:

```js fail
assert.equal(1 + 1, 3);
```

JSDoc comments in `src/index.js` hold fences too.
