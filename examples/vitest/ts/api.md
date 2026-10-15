# API Examples

Code blocks tagged `ts` or `typescript` are extracted and run as vitest tests.
Add `run` after the lang tag to include a block as a test.

## Strings

Template literals interpolate values:

```ts run
const name = "world";
expect(`hello ${name}`).toBe("hello world");
```

## Async

`Promise.all` resolves when every promise settles:

```ts run
const results = await Promise.all([Promise.resolve(1), Promise.resolve(2), Promise.resolve(3)]);
expect(results).toEqual([1, 2, 3]);
```

## Skipped example

This block is intentionally excluded from tests with `skip`:

```ts skip
expect(1).toBe(999);
```
