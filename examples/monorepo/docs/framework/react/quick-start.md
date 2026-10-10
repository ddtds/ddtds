# React Quick Start

```tsx run
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { Greeting } from "@ddtds/react-greet";

const container = document.createElement("div");
flushSync(() => createRoot(container).render(<Greeting name="Ada" />));

expect(container.textContent).toBe("Hello, Ada!");
```
