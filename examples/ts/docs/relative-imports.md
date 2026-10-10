# Relative imports

Relative imports resolve from the markdown file.

```ts run
import { add } from "./math.ts";

expect(add(1, 2)).toBe(3);
```
