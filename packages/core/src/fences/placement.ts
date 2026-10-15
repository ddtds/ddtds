/** Where a text sits in its file, such as a JSDoc comment's markdown. */
export type Placement = {
  linesBefore: number;
  /** `line` is a 0 indexed line of the text */
  columnsBeforeLine: (line: number) => number;
};

export const WHOLE_FILE: Placement = { linesBefore: 0, columnsBeforeLine: () => 0 };

function linesUpTo(source: string, offset: number): string[] {
  return source.slice(0, offset).split("\n");
}

export function linesBeforeOffset(source: string, offset: number): number {
  return linesUpTo(source, offset).length - 1;
}

export function columnsBeforeOffset(source: string, offset: number): number {
  return linesUpTo(source, offset).at(-1)?.length ?? 0;
}
