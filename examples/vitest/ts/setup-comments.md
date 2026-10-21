# Setup comments

A comment starting with `ddt-setup` above a fence runs as code before that fence. Renderers hide
the comment, so readers only see the example.

## Imports and declarations

<!-- ddt-setup import { join } from "node:path"; -->
<!-- ddt-setup const root = "/repo"; -->

```ts run
expect(join(root, "docs")).toBe("/repo/docs");
```

## Several lines

The body may span lines. Everything after the marker is code:

<!-- ddt-setup
type User = { name: string };
const user: User = { name: "ada" };
-->

```ts run
expect(user.name).toBe("ada");
```

## Blank lines

Blank lines between the comment and the fence do not matter, which keeps formatters happy:

<!-- ddt-setup const answer = 42; -->

```ts run
expect(answer).toBe(42);
```

<!-- ddt-setup const spaced = "out"; -->

```ts run
expect(spaced).toBe("out");
```

## Other comments

Comments without the marker may sit in between and are ignored:

<!-- ddt-setup const before = 1; -->
<!-- prettier-ignore -->
<!-- markdownlint-disable MD013 -->
<!-- ddt-setup const after = before + 1; -->

```ts run
expect(after).toBe(2);
```

A comment with no marker is never run, even when its body is valid code:

<!-- const leaked = "no marker"; -->

```ts run
// @ts-expect-error not defined here
expect(typeof leaked).toBe("undefined");
```

## Scope

Setup applies to the fence it sits above and nothing else. Text between a comment and a fence
breaks the link:

<!-- ddt-setup const scoped = "first fence only"; -->

```ts run
expect(scoped).toBe("first fence only");
```

The previous comment does not reach this fence, so `scoped` is not defined here:

```ts run
// @ts-expect-error not defined here
expect(typeof scoped).toBe("undefined");
```

<!-- ddt-setup const detached = "cut off"; -->

Text in between ends the search.

```ts run
// @ts-expect-error not defined here
expect(typeof detached).toBe("undefined");
```

## Lists

Setup works inside lists and other containers:

- A step with an example:

  <!-- ddt-setup const inList = "in a list"; -->

  ```ts run
  expect(inList).toBe("in a list");
  ```

## Annotations

`fail` fences get setup too:

<!-- ddt-setup const boom = () => { throw new Error("boom"); }; -->

```ts fail
boom();
```

## Inside a fence

A marker inside a fence is plain text, so it is not setup. This fence declares what it uses itself:

```ts run
const text = "<!-- ddt-setup const nope = 1; -->";
expect(text).toContain("ddt-setup");
// @ts-expect-error not defined here
expect(typeof nope).toBe("undefined");
```
