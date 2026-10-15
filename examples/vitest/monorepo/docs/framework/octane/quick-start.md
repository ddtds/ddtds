# Octane Quick Start

```tsx run
import { createRoot, flushSync } from "octane";
import { Greeting } from "@ddtds/octane-greet";

const container = document.createElement("div");
flushSync(() => createRoot(container).render(<Greeting name="Ada" />));

expect(container.textContent).toBe("Hello, Ada!");
```

```tsrx run
import { createRoot, flushSync } from "octane";
import { greet } from "@ddtds/octane-greet";

function Greeting(props: { name: string }) @{
  <p>{greet(props.name)}</p>
}

const container = document.createElement("div");
flushSync(() => createRoot(container).render(<Greeting name="Ada" />));

expect(container.textContent).toBe("Hello, Ada!");
```
