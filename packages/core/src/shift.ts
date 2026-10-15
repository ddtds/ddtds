/** How far a text is shifted from the file's own lines and columns, such as a JSDoc comment's markdown */
export type Shift = {
  /** File lines before the text */
  lines: number;
  /** File columns before the start of a 1 indexed line of the text */
  columns: (line: number) => number;
};

/** For text that is the whole file */
export const NO_SHIFT: Shift = { lines: 0, columns: () => 0 };

/** The source up to `offset`, split into the lines that come before it and the start of its own line */
function textBefore(source: string, offset: number): string[] {
  return source.slice(0, offset).split("\n");
}

/** How many lines come before `offset` in `source` */
export function linesBefore(source: string, offset: number): number {
  return textBefore(source, offset).length - 1;
}

/** How many characters come before `offset` on its own line */
export function columnsBefore(source: string, offset: number): number {
  return textBefore(source, offset).at(-1)?.length ?? 0;
}
