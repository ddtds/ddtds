import type { Position, SourceRange } from "./compile-error.ts";

export type Placement = {
  linesBefore: number;
  /** `line` is a 0 indexed line of the text */
  columnsBeforeLine: (line: number) => number;
};

export const WHOLE_FILE: Placement = { linesBefore: 0, columnsBeforeLine: () => 0 };

export function countLines(text: string): number {
  return text.split("\n").length;
}

function lastLineOf(text: string): string {
  return text.slice(text.lastIndexOf("\n") + 1);
}

export function linesBeforeOffset(source: string, offset: number): number {
  return countLines(source.slice(0, offset)) - 1;
}

export function columnsBeforeOffset(source: string, offset: number): number {
  return lastLineOf(source.slice(0, offset)).length;
}

/** Positions in markdown are 1 indexed, and in source maps and code lines they are 0 indexed */
export function zeroBased({ line, column }: Position): Position {
  return { line: line - 1, column: column - 1 };
}

export function oneBased({ line, column }: Position): Position {
  return { line: line + 1, column: column + 1 };
}

/** A 0 indexed position of the text, as a 0 indexed position of the file */
export function placeInFile(placement: Placement, inText: Position): Position {
  return {
    line: inText.line + placement.linesBefore,
    column: inText.column + placement.columnsBeforeLine(inText.line),
  };
}

/** A 1 indexed range of the text, as a 1 indexed range of the file */
export function rangeInFile(placement: Placement, inText: SourceRange): SourceRange {
  return {
    start: oneBased(placeInFile(placement, zeroBased(inText.start))),
    end: oneBased(placeInFile(placement, zeroBased(inText.end))),
  };
}

/**
 * Where the end of `text` lands when `text` is written from `start` (1 based). Every line after
 * the first begins `indent` columns in, as the container of the text strips that much.
 */
export function positionAfter(start: Position, text: string, indent: number): Position {
  const lineCount = countLines(text);
  const lastLineLength = lastLineOf(text).length;
  if (lineCount === 1) return { line: start.line, column: start.column + lastLineLength };
  return { line: start.line + lineCount - 1, column: 1 + indent + lastLineLength };
}
