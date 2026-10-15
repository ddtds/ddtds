# Server Rendering

```tsx run
import { renderToString } from "solid-js/web";
import { Greeting } from "@ddtds/solid-greet";

expect(renderToString(() => <Greeting name="Ada" />)).toBe('<p data-hk="00">Hello, Ada!</p>');
```
