# Globals

Custom `globals` in `vitest.config.ts` are available without imports

```ts run
expect(typeof vi.fn).toBe("function");
expect(typeof describe).toBe("function");
expect(basename("/a/b.ts")).toBe("b.ts");
```
