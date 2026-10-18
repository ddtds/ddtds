import type { IndexOptions } from "@ddtds/core";

export const root = "/repo";
export const options: IndexOptions = { root, moduleDir: `${root}/__ddtds__` };

/**
 * A section of a guide: prose, a list with an indented fence, a top-level fence and a
 * skipped one, so parsing and codegen see the shapes real docs use.
 */
function section(i: number): string {
  return [
    `## Step ${i}`,
    "",
    "Some prose with `inline code`, **emphasis** and a [link](https://example.com).",
    "",
    "1. Install the package:",
    "",
    "   ```sh",
    "   npm install calc",
    "   ```",
    "",
    "2. Add numbers:",
    "",
    "   ```ts run",
    '   import { add } from "calc";',
    `   expect(add(${i}, 1)).toBe(${i + 1});`,
    "   ```",
    "",
    "```js run",
    `const values = [${i}, ${i + 1}, ${i + 2}];`,
    "expect(values.map((value) => value * 2)).toHaveLength(3);",
    "```",
    "",
    "```ts",
    "// not annotated, so never run",
    "```",
    "",
  ].join("\n");
}

export function guide(sections: number): string {
  return Array.from({ length: sections }, (_, i) => section(i)).join("\n");
}

/** The same guide in MDX, with components around every fifth section */
export function mdxGuide(sections: number): string {
  return Array.from({ length: sections }, (_, i) =>
    i % 5 === 0 ? `<Steps>\n\n${section(i)}\n</Steps>\n` : section(i),
  ).join("\n");
}

/** One runnable fence, the unit the plugin serves a module for */
function fence(i: number): string {
  return [
    "```ts run",
    'import { add } from "calc";',
    `const values = [${i}, ${i + 1}];`,
    `expect(add(...values)).toBe(${2 * i + 1});`,
    "```",
    "",
  ].join("\n");
}

export function markdownSources(count: number, sections: number): Map<string, string> {
  return new Map(
    Array.from({ length: count }, (_, i) => [`${root}/docs/guide-${i}.md`, guide(sections)]),
  );
}

export function fenceSources(count: number, fences: number): Map<string, string> {
  return new Map(
    Array.from({ length: count }, (_, doc) => [
      `${root}/docs/guide-${doc}.md`,
      Array.from({ length: fences }, (_, i) => fence(i)).join("\n"),
    ]),
  );
}

/**
 * A source module whose exported functions each document usage with an `@example`
 * fence: the shape `parseJsDocFences` exists to find.
 */
export function sourceWithFences(functions: number): string {
  const parts: string[] = [];
  for (let i = 0; i < functions; i++) {
    parts.push(
      "/**",
      " * Adds a base amount to a value.",
      " *",
      " * @example",
      " * ```ts run",
      ' * import { calc } from "../src/calc.ts";',
      " *",
      ` * expect(calc(${i}, 1)).toBe(${i + 1});`,
      " * ```",
      " */",
      `export function calc${i}(value: number): number {`,
      `  return value + ${i};`,
      "}",
      "",
    );
  }
  return parts.join("\n");
}

/** The common case: source files with prose comments but no fences */
export function sourceWithoutFences(functions: number): string {
  const parts: string[] = [];
  for (let i = 0; i < functions; i++) {
    parts.push(
      "/**",
      ` * Adds ${i} to a value.`,
      " *",
      " * @param value - the value to increment",
      " * @returns the incremented value",
      " */",
      `export function increment${i}(value: number): number {`,
      `  return value + ${i};`,
      "}",
      "",
    );
  }
  return parts.join("\n");
}

export function sourceDocs(
  count: number,
  functions: number,
  build: (functions: number) => string,
): Map<string, string> {
  return new Map(
    Array.from({ length: count }, (_, i) => [`${root}/src/module-${i}.ts`, build(functions)]),
  );
}
