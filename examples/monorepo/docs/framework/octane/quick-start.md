# Octane Quick Start

```ts run
import { greet } from "@ddtds/octane-greet";

expect(greet("Ada")).toBe("Hello, Ada!");
```

Octane components are `.tsrx`, but docs tag them `tsx`. ddtds writes `.tsx` files, so the Octane
compiler never sees this fence; it is skipped until a fence can choose its file extension.

```tsx skip
import { greet } from "@ddtds/octane-greet";

export function Greeting(props: { name: string }) @{
  <p>{greet(props.name)}</p>
}
```
