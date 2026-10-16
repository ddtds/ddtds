# Solid Quick Start

```tsx run
import { render, screen } from "@solidjs/testing-library";
import { Greeting } from "@ddtds/solid-greet";

render(() => <Greeting name="Ada" />);

expect(screen.getByText("Hello, Ada!")).toBeInTheDocument();
```
