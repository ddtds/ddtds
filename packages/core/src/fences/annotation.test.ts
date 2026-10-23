import { describe, expect, test } from "vitest";
import { ANNOTATIONS } from "../annotations.ts";
import { mayHaveAnnotatedFence } from "./annotation.ts";
import { parseCodeFences } from "./blocks.ts";
import { parseJsDocFences } from "./jsdoc.ts";

const fence = (opening: string) => `prose\n${opening}\ncode\n\`\`\`\n`;

describe("mayHaveAnnotatedFence", () => {
  test.each(Object.values(ANNOTATIONS))("matches a fence annotated %s", (annotation) => {
    expect(mayHaveAnnotatedFence(fence(`\`\`\`ts ${annotation}`))).toBe(true);
  });

  test.each([
    "~~~ts run",
    '```ts title="a" twoslash run',
    "> ```ts run",
    "1. ```ts run",
    " * ```ts run",
    "```ts r&#117;n",
    "```ts compile\\_only",
  ])("matches %j", (opening) => {
    expect(mayHaveAnnotatedFence(fence(opening))).toBe(true);
  });

  test.each([
    ["no fence", "run the example below"],
    ["an unannotated fence", "```ts\nrun();\n```"],
    ["an annotation on the line after a fence opens", "```ts\nrun\n```"],
  ])("does not match %s", (_, text) => {
    expect(mayHaveAnnotatedFence(text)).toBe(false);
  });
});

// docs this lets through are parsed, so a fence it misses would silently stop running
describe("fences with an encoded annotation still run", () => {
  test.each([
    ["an entity", "```ts r&#117;n\nconst a = 1;\n```\n"],
    ["an escape", "```ts compile\\_only\nconst a = 1;\n```\n"],
  ])("in markdown, written with %s", (_, markdown) => {
    expect(parseCodeFences(markdown, "guide.md")).toHaveLength(1);
  });

  test("in a doc comment, written with an entity", () => {
    const source = "/**\n * ```ts r&#117;n\n * const a = 1;\n * ```\n */\nexport {};\n";
    expect(parseJsDocFences(source, "a.ts")).toHaveLength(1);
  });
});
