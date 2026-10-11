# Guide

## Slugs

Node strips types, so fences can be TypeScript:

```ts run
import { slugify } from "@ddtds/example-node";

const titles: string[] = ["  Getting Started ", "API & Usage"];
assert.deepEqual(titles.map(slugify), ["getting-started", "api-usage"]);
```

## Truncating

Long text ends with an ellipsis:

```ts run
import { truncate } from "@ddtds/example-node";

assert.equal(truncate("documentation", 5), "docu…");
```

A length below 1 throws, so this fence is marked `fail`:

```ts fail
import { truncate } from "@ddtds/example-node";

truncate("docs", 0);
```
