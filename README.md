# ddtds

[![CodSpeed](https://img.shields.io/endpoint?url=https://codspeed.io/badge.json)](https://codspeed.io/ddtds/ddtds?utm_source=badge)

ddtds doctests that don't suck

Imagine a world where you can just `vitest run README.md`!!! Well imagine no more, I just did that. Pretty cool right?

```bash
~/coding/ddtds pnpm exec vitest run README.md

 RUN  v5.0.3 /home/jacob/coding/ddtds

 ✓  readme  README.md (2 tests) 52ms
   ✓ README.md:13 2ms
   ✓ README.md:21 49ms

 Test Files  1 passed (1)
      Tests  2 passed (2)
Type Errors  no errors
   Start at  02:02:01
   Duration  477ms (environment 51%, import 26%, tests 13%, transform 9%, worker 1%)
```

Documentation is much better when you and your users can be sure it's up to date

```ts run
const numbers = [1, 2, 3, 4];
// map creates a new array by calling the provided function on each item of the original array
expect(numbers.map((x) => x + 1)).toStrictEqual([2, 3, 4, 5]);
```

run whatever frameworks or tests your test framework already supports. Here's some react

```tsx run
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

function CutestAnimal() {
  const [animal, setAnimal] = useState("");
  return (
    <form>
      <label>
        Cutest animal
        <input value={animal} onChange={(event) => setAnimal(event.target.value)} />
      </label>
      <output>The cutest animal is {animal || "..."}</output>
    </form>
  );
}

render(<CutestAnimal />);
await userEvent.type(screen.getByLabelText("Cutest animal"), "otter");
expect(screen.getByRole("status").textContent).toBe("The cutest animal is otter");
```

## Architecture

1. parse codeblocks + tags
2. build testfiles in memory
3. run with repo config

Takes advantage of existing test config instead of a separate compiler config or test config

## Packages

- `./packages` has ddtdts library and cli code
  - core has agnostic logic for finding and parsing codefences and test codegen
  - vitest is vitest specific logic and plugin
  - cli is an experimental tool eventually meant to help with incremental converstion of your codebase
- `./examples` has react, typescript, javascript examples

## Alternatives

TODO verify these claims and also find more alternatives

typescript-docs-verifier typechecks with a custom config, I don't believe it allows for custom compilers so react is off the table

markdown-doctest seems pretty old looking and only works with js

## Roadmap

Must haves

- [x] generic template string to add generic top level imports and test func
- [x] support vitest
- [ ] support node:test
- sourcemapping
- [x] stack traces
- [ ] coverage reports
- [x] watch mode

- [ ] hide boilerplate (should it be # or other syntax)
- [x] annotations (run, fail, skip)
- [ ] agent skill to aid with migration and fixing build failures (prefer adding hidden imports to compile, do not add assertions??)
- [x] ignore config
- [x] Hoisting imports (what if conflicting? should we just rewrite to dynamic imports??? one file per test?). I ended up using modules for isolation and per file is slow when environments exist
- [ ] dynamic imports
- [ ] ban relative paths
- [x] test isolation (users ideally shouldn't be setting globals in tests, should we deal with this ourselves?). Each test is its own module
- [x] monorepo with multiple testing roots (I think doctest package would be best here to avoid polluting the dev deps in root)
- [ ] strip export/export default
- [x] don't crash process on compile failure
- [ ] ESM + CJS support
- [ ] type checking

Nice to haves

- [ ] CLI
- [ ] other framework support like rstest or jest
- [ ] JSON output for ratcheting/LLM consumption/MCP
- [ ] JSDOC stuff
