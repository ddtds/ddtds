# Octane Quick Start

```tsx run
import { createRoot, flushSync } from "octane";
import { Greeting } from "@ddtds/octane-greet";

const container = document.createElement("div");
flushSync(() => createRoot(container).render(<Greeting name="Ada" />));

expect(container.textContent).toBe("Hello, Ada!");
```
