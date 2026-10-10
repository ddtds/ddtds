# Octane Quick Start

```ts run
import { greet } from "@ddtds/octane-greet";

expect(greet("Ada")).toBe("Hello, Ada!");
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
