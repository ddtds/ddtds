# API Examples (JavaScript)

Code blocks tagged `js` or `javascript` are extracted and run as vitest tests.

## Arrays

Mapping over an array doubles each element:

```js run
const result = [1, 2, 3].map((x) => x * 2);
expect(result).toEqual([2, 4, 6]);
```

Filtering keeps only items that pass the predicate:

```js run
const evens = [1, 2, 3, 4, 5].filter((x) => x % 2 === 0);
expect(evens).toEqual([2, 4]);
```

`reduce` accumulates values:

```js run
const sum = [1, 2, 3, 4].reduce((acc, x) => acc + x, 0);
expect(sum).toBe(10);
```

## Strings

Template literals interpolate values:

```js run
const name = "world";
expect(`hello ${name}`).toBe("hello world");
```

## Objects

Spread merges objects without mutating the originals:

```js run
const base = { a: 1, b: 2 };
const extended = { ...base, c: 3 };
expect(extended).toEqual({ a: 1, b: 2, c: 3 });
expect(base).toEqual({ a: 1, b: 2 });
```

## Async

`Promise.all` resolves when every promise settles:

```js run
const results = await Promise.all([Promise.resolve(1), Promise.resolve(2), Promise.resolve(3)]);
expect(results).toEqual([1, 2, 3]);
```

## Expected throw

Use `fail` when a block is expected to throw:

```js fail
throw new Error("boom");
```

## Skipped example

This block is intentionally broken but tagged `skip` so it won't run:

```js skip
expect(1).toBe(999);
```
