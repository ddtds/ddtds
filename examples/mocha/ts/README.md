# Mocha Example

Fences run with `mocha`, asserting with the strict `assert` from `node:assert`.

```ts run
import { slugify } from "@ddtds/example-mocha";

assert.equal(slugify("Hello, World!"), "hello-world");
```

Types are stripped by Node, so fences can be TypeScript:

```ts run
import { slugify } from "@ddtds/example-mocha";

const titles: string[] = ["  Getting Started ", "API & Usage"];
assert.deepEqual(titles.map(slugify), ["getting-started", "api-usage"]);
```

A `fail` fence passes only when it throws:

```ts fail
assert.equal(1 + 1, 3);
```

JSDoc comments in `src/index.ts` hold fences too.
