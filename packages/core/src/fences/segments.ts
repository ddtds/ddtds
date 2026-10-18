import type { Position } from "./compile-error.ts";
import { countLines } from "./placement.ts";

export type TextRun = {
  firstTextLine: number;
  firstLineColumn: number;
  /** Column in the text where every later line starts, which is how far its container indents */
  laterLinesColumn: number;
};

export type CodeRun = TextRun & { code: string };

export type Segment = TextRun & { firstCodeLine: number };

export function codeWithSetup(setup: readonly CodeRun[], fenceCode: string): string {
  return setup.map((run) => `${run.code}\n`).join("") + fenceCode;
}

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
