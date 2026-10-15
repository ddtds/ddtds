import { expect, test } from "vitest";
import { columnsBeforeOffset, linesBeforeOffset } from "./placement.ts";

const source = "ab\ncd\r\nef";

test("counts the lines before an offset", () => {
  expect([0, 2, 3, 6, 7].map((offset) => linesBeforeOffset(source, offset))).toEqual([
    0, 0, 1, 1, 2,
  ]);
});

test("counts the characters before an offset on its own line", () => {
  expect([0, 1, 3, 4, 5, 7, 8].map((offset) => columnsBeforeOffset(source, offset))).toEqual([
    0, 1, 0, 1, 2, 0, 1,
  ]);
});

test("an offset at the very start has nothing before it, even when the source starts with a newline", () => {
  expect([linesBeforeOffset("\nab", 0), columnsBeforeOffset("\nab", 0)]).toEqual([0, 0]);
  expect([linesBeforeOffset("\nab", 1), columnsBeforeOffset("\nab", 1)]).toEqual([1, 0]);
});
