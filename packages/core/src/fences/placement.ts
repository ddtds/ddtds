import type { Position, SourceRange } from "./compile-error.ts";

export type Placement = {
  linesBefore: number;
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

/** `linesBeforeOffset` for many offsets into one source, scanning the source once */
export function lineIndex(source: string): (offset: number) => number {
  const lineStarts = [0];
  for (let i = source.indexOf("\n"); i !== -1; i = source.indexOf("\n", i + 1)) {
    lineStarts.push(i + 1);
  }
  return (offset) => {
    let low = 0;
    let high = lineStarts.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      const start = lineStarts[middle];
      if (start !== undefined && start <= offset) low = middle + 1;
      else high = middle;
    }
    return low - 1;
  };
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

export function placeInFile(placement: Placement, inText: Position): Position {
  return {
    line: inText.line + placement.linesBefore,
    column: inText.column + placement.columnsBeforeLine(inText.line),
  };
}

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
