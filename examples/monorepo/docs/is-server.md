# Server Detection

`@ddtds/greet/is-server` has a build per environment. Tests get the `development` build, which leaves the environment undecided.

```ts run
import { isServer } from "@ddtds/greet/is-server";

expect(isServer).toBeUndefined();
```
