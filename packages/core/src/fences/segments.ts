import type { Position } from "./compile-error.ts";
import { countLines } from "./placement.ts";

/** Where lines of code were written in the text. Lines and columns are 0 indexed. */
export type TextRun = {
  firstTextLine: number;
  /** Column in the text where the first line starts */
  firstLineColumn: number;
  /** Column in the text where every later line starts, which is how far its container indents */
  laterLinesColumn: number;
};

/** Code written at a place in the text, such as the body of a setup comment */
export type CodeRun = TextRun & { code: string };

/** A `TextRun` holding the lines of a block's code from `firstCodeLine` on */
export type Segment = TextRun & { firstCodeLine: number };

/** Every setup body followed by a newline, then the fence code */
export function codeWithSetup(setup: readonly CodeRun[], fenceCode: string): string {
  return setup.map((run) => `${run.code}\n`).join("") + fenceCode;
}

/** Where the lines of `codeWithSetup` were written. `fenceStart` is the 0 indexed position of the fence's opening line */
export function segmentsOf(setup: readonly CodeRun[], fenceStart: Position): Segment[] {
  const segments: Segment[] = [];
  let firstCodeLine = 0;
  for (const { code, ...run } of setup) {
    segments.push({ ...run, firstCodeLine });
    firstCodeLine += countLines(code);
  }
  segments.push({
    firstCodeLine,
    firstTextLine: fenceStart.line + 1,
    firstLineColumn: fenceStart.column,
    laterLinesColumn: fenceStart.column,
  });
  return segments;
}

function segmentHoldingCodeLine(segments: readonly Segment[], codeLine: number): Segment {
  const segment = segments.findLast((candidate) => candidate.firstCodeLine <= codeLine);
  if (!segment) throw new Error(`no code at line ${codeLine}`);
  return segment;
}

/** Where `codeColumn` of `codeLine` was written in the text, all 0 indexed */
export function positionInText(
  segments: readonly Segment[],
  codeLine: number,
  codeColumn: number,
): Position {
  const segment = segmentHoldingCodeLine(segments, codeLine);
  const linesIntoSegment = codeLine - segment.firstCodeLine;
  const lineColumn = linesIntoSegment === 0 ? segment.firstLineColumn : segment.laterLinesColumn;
  return { line: segment.firstTextLine + linesIntoSegment, column: lineColumn + codeColumn };
}
