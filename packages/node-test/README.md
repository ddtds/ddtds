# @ddtds/node-test

## quick start

Default node hooks are exported to get started

```bash
node --test --import @ddtds/node-test/register "*.md"
```

## globals

By default, doc tests import `assert` and `mock`

Set `globals` to an empty array in your own register file to avoid any default imports

```ts run
import { registerHooks } from "node:module";
import { ddtHooks } from "@ddtds/node-test";

registerHooks(ddtHooks(process.cwd(), { globals: [] }));
```

```bash
node --test --import ./register.ts "*.md"
```

To add to the defaults, spread `defaultGlobals`. `nodeTestImports` types names from node:test and `typedImports` can type safely import from any library!

```ts run
import { registerHooks } from "node:module";
import { ddtHooks, defaultGlobals, nodeTestImports, typedImports } from "@ddtds/node-test";

const importFromPath = typedImports<typeof import("node:path")>("node:path");

registerHooks(
  ddtHooks(process.cwd(), {
    globals: [...defaultGlobals, nodeTestImports("describe"), importFromPath("basename")],
  }),
);
```

Tests can safely shadow variables

```ts run
const mock = 5;
assert.equal(mock, 5);
```
