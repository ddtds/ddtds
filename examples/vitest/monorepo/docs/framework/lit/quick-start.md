# Lit Quick Start

```ts run
import { DdtdsGreeting } from "@ddtds/lit-greet";

const el = new DdtdsGreeting();
el.name = "Ada";
document.body.append(el);
await el.updateComplete;

expect(el.shadowRoot?.textContent).toBe("Hello, Ada!");
el.remove();
```
