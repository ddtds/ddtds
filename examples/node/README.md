# Node Example

A small string library whose unit tests and docs both run with `node --test`:

```sh
node --enable-source-maps --test --import @ddtds/node/register "test/*.test.ts" "docs/*.md" README.md
```

Fences assert with `assert` from `node:assert`, in strict mode:

```ts run
import { slugify } from "@ddtds/example-node";

assert.equal(slugify("Hello, World!"), "hello-world");
```

See [the guide](docs/guide.md) for more.
