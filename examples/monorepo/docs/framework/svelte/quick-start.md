# Svelte Quick Start

```ts run
import { mount, unmount } from "svelte";
import { Greeting } from "@ddtds/svelte-greet";

const target = document.createElement("div");
const component = mount(Greeting, { target, props: { name: "Ada" } });

expect(target.textContent).toBe("Hello, Ada!");
unmount(component);
```
