# Angular Quick Start

```ts run
import { render, screen } from "@testing-library/angular";
import { Greeting } from "@ddtds/angular-greet";

await render(Greeting, { inputs: { name: "Ada" } });

expect(screen.getByText("Hello, Ada!")).toBeInTheDocument();
```
