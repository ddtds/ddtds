# Vitest globals

`ddtPlugin({ globals })` lists what fences use without importing. It defaults to `defaultGlobals`, `expect` and `vi`.

Spread `defaultGlobals` to add more. `vitestImports` types names from vitest, and `typedImports` types names from any other library.

```ts run
expect(typeof vi.fn).toBe("function");
expect(typeof describe).toBe("function");
expect(basename("/a/b.ts")).toBe("b.ts");
```

A fence can still import a name the runner injects:

```ts run
import { describe, expect } from "vitest";

expect(typeof describe).toBe("function");
```
