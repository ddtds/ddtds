# Octane Quick Start

```tsx run
import { screen } from "@testing-library/dom";
import { createRoot, flushSync } from "octane";
import { Greeting } from "@ddtds/octane-greet";

const container = document.body.appendChild(document.createElement("div"));
flushSync(() => createRoot(container).render(<Greeting name="Ada" />));

expect(screen.getByText("Hello, Ada!")).toBeInTheDocument();
```

```tsrx run
import { screen } from "@testing-library/dom";
import { createRoot, flushSync } from "octane";
import { greet } from "@ddtds/octane-greet";

function Greeting(props: { name: string }) @{
  <p>{greet(props.name)}</p>
}

const container = document.body.appendChild(document.createElement("div"));
flushSync(() => createRoot(container).render(<Greeting name="Ada" />));

expect(screen.getByText("Hello, Ada!")).toBeInTheDocument();
```
