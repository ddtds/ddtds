# Vue Quick Start

```ts run
import { createApp } from "vue";
import { Greeting } from "@ddtds/vue-greet";

const container = document.createElement("div");
const app = createApp(Greeting, { name: "Ada" });
app.mount(container);

expect(container.textContent).toBe("Hello, Ada!");
app.unmount();
```
