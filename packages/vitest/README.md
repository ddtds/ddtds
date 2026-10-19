# @ddtds/vitest

## performance

`fsModuleCache` saves several seconds on warm transform times. vitest v5+ has `fsModuleCache` and v5.0.4 turns it on by default

## globals

By default, doc tests import `expect` and `vi`. Vitest globals are available in doc tests

Set `globals` to an empty array and turn off vitest flobals to avoid any default imports

```ts run
import { defineConfig } from "vitest/config";
import { ddtPlugin } from "@ddtds/vitest";

export default defineConfig({
  test: {
    globals: false, // false by default
  },
  plugins: [ddtPlugin({ globals: [] })],
});
```

To add to the defaults, spread `defaultGlobals`. `vitestImports` types names from vitest and `typedImports` can type ssfely import from any library!

```ts run
import { defineConfig } from "vitest/config";
import { ddtPlugin, defaultGlobals, typedImports, vitestImports } from "@ddtds/vitest";

const importFromUserEvent = typedImports<typeof import("@testing-library/user-event")>(
  "@testing-library/user-event",
);

export default defineConfig({
  plugins: [
    ddtPlugin({
      globals: [...defaultGlobals, vitestImports("describe"), importFromUserEvent("userEvent")],
    }),
  ],
});
```

Tests can safely shadow variables

```ts run
const vi = 5;
expect(vi).toBe(5);
```
