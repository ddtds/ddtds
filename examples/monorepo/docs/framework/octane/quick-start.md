# Octane Quick Start

```ts run
import { greet } from "@ddtds/octane-greet";

expect(greet("Ada")).toBe("Hello, Ada!");
```

```tsrx run
import { greet } from "@ddtds/octane-greet";

export function Greeting(props: { name: string }) {
  return <p>{greet(props.name)}</p>;
}
```
