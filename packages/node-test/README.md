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

## logging

ddtds logs fences with unknown annotations, and with `debug`, which module each fence resolves to

The log level is resolved like so

1. `DDT_LOG_LEVEL` environment variable
2. `logLevel` option
3. Default (`"info"`)

```ts run
import { registerHooks } from "node:module";
import { ddtHooks } from "@ddtds/node-test";

registerHooks(ddtHooks(process.cwd(), { logLevel: "error" }));
```

```bash
DDT_LOG_LEVEL=debug node --test --import @ddtds/node-test/register "*.md"
```

Levels are `trace`, `debug`, `info`, `warning`, `error` and `fatal`. Logs are written to stderr
