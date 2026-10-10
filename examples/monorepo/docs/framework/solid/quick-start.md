# Solid Quick Start

```tsx run
import { render } from "solid-js/web";
import { Greeting } from "@ddtds/solid-greet";

const container = document.createElement("div");
const dispose = render(() => <Greeting name="Ada" />, container);

expect(container.textContent).toBe("Hello, Ada!");
dispose();
```
