import { describe, expect, test } from "vitest";
import { positionAfter } from "./placement.ts";
import { codeWithSetup, positionInText, segmentsOf } from "./segments.ts";

const setupAt = (code: string, firstTextLine: number, firstLineColumn: number, indent = 0) => ({
  code,
  firstTextLine,
  firstLineColumn,
  laterLinesColumn: indent,
});

describe("positionAfter", () => {
  test("moves along the line for text without a newline", () => {
    expect(positionAfter({ line: 3, column: 5 }, "<!-- ddt-setup", 0)).toEqual({
      line: 3,
      column: 19,
    });
  });

  test("moves to the last line and counts the indent there", () => {
    expect(positionAfter({ line: 3, column: 5 }, "<!--\nddt-setup", 2)).toEqual({
      line: 4,
      column: 12,
    });
  });
});

describe("codeWithSetup", () => {
  test("puts a newline after each setup body and none after the fence code", () => {
    expect(codeWithSetup([setupAt("a", 0, 0), setupAt("b", 1, 0)], "c")).toBe("a\nb\nc");
  });

  test("is the fence code alone without setup", () => {
    expect(codeWithSetup([], "c")).toBe("c");
  });
});

describe("positionInText", () => {
  const segments = segmentsOf(
    [setupAt("\nconst a = 1;\n", 4, 14, 2), setupAt(" const b = 2; ", 8, 14)],
    { line: 10, column: 2 },
  );

  test("starts the first line of a setup body at the column after its marker", () => {
    expect(positionInText(segments, 0, 0)).toEqual({ line: 4, column: 14 });
  });

  test("starts later lines of a setup body at its container indent", () => {
    expect(positionInText(segments, 1, 0)).toEqual({ line: 5, column: 2 });
    expect(positionInText(segments, 1, 6)).toEqual({ line: 5, column: 8 });
  });

  test("continues with the next setup body after the lines of the previous one", () => {
    expect(positionInText(segments, 3, 1)).toEqual({ line: 8, column: 15 });
  });

  test("starts the fence on the line after its opening, at its indent", () => {
    expect(positionInText(segments, 4, 0)).toEqual({ line: 11, column: 2 });
    expect(positionInText(segments, 5, 3)).toEqual({ line: 12, column: 5 });
  });
});
