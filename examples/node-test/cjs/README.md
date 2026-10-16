# Node CommonJS Example

Fences run with `node --test`. This package is CommonJS, so fences use `require`:

```js run
const { slugify } = require("@ddtds/example-node-cjs");

assert.equal(slugify("Hello, World!"), "hello-world");
```

A `fail` fence passes only when it throws:

```js fail
assert.equal(1 + 1, 3);
```
