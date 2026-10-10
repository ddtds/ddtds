# Preact Quick Start

```tsx run
import { render } from "preact";
import { Greeting } from "@ddtds/preact-greet";

const container = document.createElement("div");
render(<Greeting name="Ada" />, container);

expect(container.textContent).toBe("Hello, Ada!");
```
