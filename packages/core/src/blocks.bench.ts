import { bench, describe } from "vitest";
import { CodeBlock } from "./blocks";

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

describe("CodeBlock.splitImports", () => {
  bench("split imports and sanitize block", () => {
    new CodeBlock({
      code,
      lang: "ts",
      annotation: null,
      meta: "",
      path: "bench.md",
      range: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } },
      indent: 0,
    }).splitImports();
  });
});
