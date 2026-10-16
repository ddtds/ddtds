# React Quick Start

```tsx run
import { render, screen } from "@testing-library/react";
import { Greeting } from "@ddtds/react-greet";

render(<Greeting name="Ada" />);

expect(screen.getByText("Hello, Ada!")).toBeInTheDocument();
```
