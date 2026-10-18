# ddtds - ddtds doctests that don't suck

[![CodSpeed](https://img.shields.io/endpoint?url=https://codspeed.io/badge.json)](https://codspeed.io/ddtds/ddtds?utm_source=badge)

Imagine a world where you can just `vitest run README.md`!!! Well imagine no more, I just did that. Pretty cool right?

```bash
~/coding/ddtds pnpm exec vitest run README.md

 RUN  v5.0.3 /home/jacob/coding/ddtds

 ✓  readme  README.md (1 test) 49ms
   ✓ README.md:29 49ms

 Test Files  1 passed (1)
      Tests  1 passed (1)
Type Errors  no errors
   Start at  02:02:01
   Duration  477ms (environment 51%, import 26%, tests 13%, transform 9%, worker 1%)
```

ddtds uses your existing test configs, if you already test react, just add the plugin!

<!-- ddt-setup
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
-->

```tsx run
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

A comment starting with `ddt-setup` above a fence runs as code before the fence

````md
<!-- ddt-setup
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
-->

```tsx run
import { useState } from "react";

function CutestAnimal() {
  // ...
}

render(<CutestAnimal />);
await userEvent.type(screen.getByLabelText("Cutest animal"), "otter");
expect(screen.getByRole("status").textContent).toBe("The cutest animal is otter");
```
````

Can extract code from these files

- md
- mdx

Can extract and run these languages

- js
- ts
- jsx
- tsx
- tsrx
- mjs
- mts
- cjs
- cts

Module type served to your framework of choice resolves in the following order

1. Fence language (cts means typescript)
2. Sniffs for ESM only syntax like static imports
3. Nearest Package JSON module type
4. Global default in case the type is at what it seems, for example, bundler transforms
5. Frameworks decide what to do with the hint. E.g node respects the module type and [vitest injects compatibility layers, checks package.json and sniffs import statements](https://vitest.dev/config/injectcjsglobals)

## setup comments specifics

- Markdown and JSDoc use `<!-- ddt-setup ... -->`, MDX uses `{/* ddt-setup ... */}`.
- Several setup comments in a row are supported
- Blank lines and other comments are ignored between comments
- Setup applies to the next fence only

## Vitest

See [packages/vitest](packages/vitest/README.md)

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
