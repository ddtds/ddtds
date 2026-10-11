<!-- @vitest-environment node -->

# Server Rendering

```tsx run
import { renderToString } from "react-dom/server";
import { Greeting } from "@ddtds/react-greet";

expect(typeof document).toBe("undefined");
expect(renderToString(<Greeting name="Ada" />)).toBe("<p>Hello, Ada!</p>");
```
