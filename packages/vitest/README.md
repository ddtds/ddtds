# @ddtds/vitest

## performance

Note: `fsModuleCache` saves several seconds on warm transform times. vitest v5+ has `fsModuleCache` and v5.0.4 turns it on by default

## globals

If globals are enabled in your main vitest config, they will be available in your doc tests. However, you may want globals on only for doc tests or additional globals and aliases

By default doc tests get `expect` and `vi` without importing them. To change that, provide a custom `globals` array. An empty array injects nothing

```ts run
import { defineConfig } from "vitest/config";
import { ddtPlugin } from "@ddtds/vitest";

export default defineConfig({
  plugins: [ddtPlugin({ globals: [] })],
});
```

If you’d like custom globals, you can type safely add them with `typedImports` like so

```ts run
import { defineConfig } from "vitest/config";
import { ddtPlugin, defaultGlobals, typedImports } from "@ddtds/vitest";

const importFromUserEvent = typedImports<typeof import("@testing-library/user-event")>(
  "@testing-library/user-event",
);

export default defineConfig({
  plugins: [ddtPlugin({ globals: [...defaultGlobals, importFromUserEvent("userEvent")] })],
});
```

```ts run
const button = document.createElement("button");
let clicked = false;
button.addEventListener("click", () => (clicked = true));

await userEvent.click(button);
expect(clicked).toBe(true);
```
