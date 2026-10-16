# Preact Quick Start

```tsx run
import { render, screen } from "@testing-library/preact";
import { Greeting } from "@ddtds/preact-greet";

render(<Greeting name="Ada" />);

expect(screen.getByText("Hello, Ada!")).toBeInTheDocument();
```
