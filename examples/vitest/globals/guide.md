# Vitest globals

`ddtPlugin({ globals: "full" })` gives fences vitest's globals without turning on `test.globals` for the project.

A fence can use `vi` and `expect` without importing them, which `"minimal"` also allows:

```ts run
expect(typeof vi.fn).toBe("function");
```

A fence can use `describe`, which only `"full"` injects:

```ts run
expect(typeof describe).toBe("function");
```

A fence can import a name the runner injects:

```ts run
import { describe, expect } from "vitest";

expect(typeof describe).toBe("function");
```
