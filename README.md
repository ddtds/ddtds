# ddtds doctests that don't suck

[![CodSpeed](https://img.shields.io/endpoint?url=https://codspeed.io/badge.json)](https://codspeed.io/ddtds/ddtds?utm_source=badge)

Imagine a world where you can just vitest run README.md!!! ddtds uses your existing test and TypeScript config to run and typecheck code examples in Markdown and JSDoc comments

```bash
~/coding/ddtds pnpm exec vitest run README.md

 ✓  readme  README.md (1 test) 49ms
   ✓ README.md:23 49ms
```

<!-- ddt-setup
import { render, screen } from "@testing-library/react";
-->

```tsx run
render(<p>Hello</p>);
expect(screen.getByText("Hello")).toBeTruthy();
```

## plugins

ddtds plugs into your test runner, so the docs run alongside your other tests

- [node:test](packages/node-test/README.md)
- [vitest](packages/vitest/README.md)

See [architecture](architecture.md) if you are interested in how it all works!

## annotations

Annotations after the fence's language define how a fence is handled

| Annotation     | Should compile | Passes when              |
| -------------- | -------------- | ------------------------ |
| `run`          | yes            | the fence does not throw |
| `fail`         | yes            | the fence throws         |
| `compile_only` | yes            | not run                  |
| `compile_fail` | no             | not run                  |
| `skip`         | not compiled   | not run                  |

For example, this fence has a `fail` annotation. It must compile, and it passes because it throws

````md
```ts fail
expect(1).toBe(2);
```
````

By default, test names are file locations. Use a title to set a name for easier filtering

````md
```ts title="adds numbers" run
expect(1 + 1).toBe(2);
```
````

```bash
~/coding/ddtds pnpm exec vitest run README.md

 ✓  readme  README.md (1 test) 49ms
   ✓ adds numbers 49ms
```

## setup comments

One to many comments starting with `ddt-setup` are included in the following fence and hidden from markdown renderers. Use this for obvious or irrelevant imports

Markdown and JSDoc use `<!-- ddt-setup ... -->`, MDX uses `{/* ddt-setup ... */}`


````md
<!-- ddt-setup
import { render, screen } from "@testing-library/react";
-->

```tsx run
render(<p>Hello</p>);
expect(screen.getByText("Hello")).toBeTruthy();
```
````

## supported files

Can extract code from `md` and `mdx` files, and from JSDoc comments in `js`, `ts`, `jsx`, `tsx`, `mjs`, `mts`, `cjs` and `cts` source files

Can extract and run these languages: `js`, `ts`, `jsx`, `tsx`, `tsrx`, `mjs`, `mts`, `cjs`, `cts`

Module type served to your framework of choice resolves in the following order

1. Fence language (cts means typescript)
2. Sniffs for ESM only syntax like static imports
3. Nearest Package JSON module type
4. Global default in case the type is at what it seems, for example, bundler transforms
5. Frameworks decide what to do with the hint. E.g node respects the module type and [vitest injects compatibility layers, checks package.json and sniffs import statements](https://vitest.dev/config/injectcjsglobals)


## logging

debug level helps troubleshoot what module type a fence resolves to and where's it's generated

The log level is resolved like so

1. `DDT_LOG_LEVEL` environment variable
2. `logLevel` option
3. Default (`"info"`)

