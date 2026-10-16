# Lit Quick Start

```ts run
import { screen } from "shadow-dom-testing-library";
import { DdtdsGreeting } from "@ddtds/lit-greet";

const el = new DdtdsGreeting();
el.name = "Ada";
document.body.append(el);
await el.updateComplete;

expect(screen.getByShadowText("Hello, Ada!")).toBeInTheDocument();
```
