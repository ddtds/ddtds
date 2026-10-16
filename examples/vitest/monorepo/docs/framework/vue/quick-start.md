# Vue Quick Start

```ts run
import { render, screen } from "@testing-library/vue";
import { Greeting } from "@ddtds/vue-greet";

render(Greeting, { props: { name: "Ada" } });

expect(screen.getByText("Hello, Ada!")).toBeInTheDocument();
```
