# Vitest globals

This project sets `globals: true`, so fences can use vitest's API without importing it.

A fence can use a global the runner does not inject:

```ts run
expect(typeof describe).toBe("function");
expect(typeof vi.fn).toBe("function");
```

A fence can import a name the runner does not inject, even when the global is on:

```ts run
import { describe } from "vitest";

expect(typeof describe).toBe("function");
```

A fence can import `expect`, which the runner injects too:

```ts run
import { expect } from "vitest";

expect(1 + 1).toBe(2);
```
