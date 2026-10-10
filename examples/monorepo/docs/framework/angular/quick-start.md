# Angular Quick Start

```ts run
import { createComponent } from "@angular/core";
import { createApplication } from "@angular/platform-browser";
import { Greeting } from "@ddtds/angular-greet";

const app = await createApplication();
const greeting = createComponent(Greeting, { environmentInjector: app.injector });
greeting.setInput("name", "Ada");
greeting.changeDetectorRef.detectChanges();

expect(greeting.location.nativeElement.textContent).toBe("Hello, Ada!");
app.destroy();
```
