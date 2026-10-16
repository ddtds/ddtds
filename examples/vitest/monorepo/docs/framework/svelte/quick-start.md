# Svelte Quick Start

```ts run
import { render, screen } from "@testing-library/svelte";
import { Greeting } from "@ddtds/svelte-greet";

render(Greeting, { props: { name: "Ada" } });

expect(screen.getByText("Hello, Ada!")).toBeInTheDocument();
```
