# Angular Quick Start

```ts run
import { signal } from "@angular/core";
import { greeting } from "@ddtds/angular-greet";

const name = signal("Ada");
const message = greeting(name);
expect(message()).toBe("Hello, Ada!");

name.set("Grace");
expect(message()).toBe("Hello, Grace!");
```
