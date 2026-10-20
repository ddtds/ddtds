import { test } from "vitest";
import { CodeBlock } from "@ddtds/core/fences";

const code = `import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export interface User {
  id: string;
}

export type UserMap = Record<string, User>;

export const base = 2;

export function addOne(x: number): number {
  return x + 1;
}

export default class Greeter {
  constructor(private readonly name: string) {}

  greet() {
    return \`hello \${this.name}\`;
  }
}

declare const neverDefined: number;

const dir = dirname(fileURLToPath(new URL("file:///tmp/example.ts")));
const users: UserMap = {
  a: { id: "a" },
};

expect(join(dir, users.a.id)).toContain("a");
expect(addOne(base)).toBe(3);
expect(new Greeter("world").greet()).toBe("hello world");`;

test("splitImports", async ({ bench }) => {
  const block = new CodeBlock({
    code,
    lang: "ts",
    annotation: null,
    path: "bench.md",
    rangeInText: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } },
  });
  await bench("split imports and sanitize block", () => {
    block.splitImports();
  }).run();
});
