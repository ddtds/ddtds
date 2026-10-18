# Node Example

Fences run with `node --test`, asserting with the strict `assert` from `node:assert`.

```ts run
import { slugify } from "@ddtds/example-node";

assert.equal(slugify("Hello, World!"), "hello-world");
```

Types are stripped by Node, so fences can be TypeScript:

```ts run
import { slugify } from "@ddtds/example-node";

const titles: string[] = ["  Getting Started ", "API & Usage"];
assert.deepEqual(titles.map(slugify), ["getting-started", "api-usage"]);
```

A `fail` fence passes only when it throws:

```ts fail
assert.equal(1 + 1, 3);
```

A `ddt-setup` comment above a fence runs as code before it, and readers never see it. Blank lines and other comments may sit in between:

<!-- ddt-setup import { slugify } from "@ddtds/example-node"; -->

<!-- not setup, no marker -->

```ts run
assert.equal(slugify("Set Up"), "set-up");
```

JSDoc comments in `src/index.ts` hold fences too.
