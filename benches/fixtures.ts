import type { IndexOptions } from "@ddtds/core/docs";

export const root = "/repo";
export const options: IndexOptions = { root, moduleDir: `${root}/__ddtds__` };

/**
 * A section of a guide: prose, a list with an indented `sh` fence and an indented runnable
 * fence, a top-level runnable fence and an unannotated one, so parsing and codegen see the
 * shapes real docs use. 2 of its 4 fences run
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

const RUNNABLE_FENCES_PER_SECTION = 2;

function sections(runnableFences: number): number[] {
  return Array.from({ length: runnableFences / RUNNABLE_FENCES_PER_SECTION }, (_, i) => i);
}

/** A markdown guide with this many runnable fences, among as many that don't run */
export function guide(runnableFences: number): string {
  return sections(runnableFences).map(section).join("\n");
}

/** The same guide in MDX, with components around every fifth section */
export function mdxGuide(runnableFences: number): string {
  return sections(runnableFences)
    .map((i) => (i % 5 === 0 ? `<Steps>\n\n${section(i)}\n</Steps>\n` : section(i)))
    .join("\n");
}

export function markdownDocs(docs: number, runnableFencesPerDoc: number): Map<string, string> {
  return new Map(
    Array.from({ length: docs }, (_, i) => [
      `${root}/docs/guide-${i}.md`,
      guide(runnableFencesPerDoc),
    ]),
  );
}

/** The same docs with `run` removed from every fence, so none of them run */
export function withoutAnnotations(docs: Map<string, string>): Map<string, string> {
  return new Map(
    Array.from(docs, ([path, text]) => [path, text.replaceAll(/(```\w+) run/g, "$1")]),
  );
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

/** Docs of nothing but runnable fences */
export function fenceDocs(docs: number, fencesPerDoc: number): Map<string, string> {
  return new Map(
    Array.from({ length: docs }, (_, doc) => [
      `${root}/docs/guide-${doc}.md`,
      Array.from({ length: fencesPerDoc }, (_, i) => fence(i)).join("\n"),
    ]),
  );
}

/**
 * A source module of functions whose doc comments each have one `@example` fence: the
 * shape `parseJsDocFences` exists to find
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

/** The common case: a source module of functions whose doc comments are prose */
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

export function sourceDocs(files: number, source: string): Map<string, string> {
  return new Map(Array.from({ length: files }, (_, i) => [`${root}/src/module-${i}.ts`, source]));
}
