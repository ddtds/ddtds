import { describe, expect, test } from "vitest";
import { ANNOTATIONS } from "../annotations.ts";
import { ANNOTATED_FENCE } from "./annotation.ts";

const fence = (opening: string) => `prose\n${opening}\ncode\n\`\`\`\n`;

describe("ANNOTATED_FENCE", () => {
  test.each(Object.values(ANNOTATIONS))("matches a fence annotated %s", (annotation) => {
    expect(ANNOTATED_FENCE.test(fence(`\`\`\`ts ${annotation}`))).toBe(true);
  });

  test.each([
    "~~~ts run",
    '```ts title="a" twoslash run',
    "> ```ts run",
    "1. ```ts run",
    " * ```ts run",
  ])("matches %j", (opening) => {
    expect(ANNOTATED_FENCE.test(fence(opening))).toBe(true);
  });

  test.each([
    ["no fence", "run the example below"],
    ["an unannotated fence", "```ts\nrun();\n```"],
    ["an annotation on the line after a fence opens", "```ts\nrun\n```"],
  ])("does not match %s", (_, text) => {
    expect(ANNOTATED_FENCE.test(text)).toBe(false);
  });
});
