/** Where a text sits in the file it was taken from, such as a JSDoc comment's markdown */
export type Offset = {
  /** File lines before the text */
  lines: number;
  /** File columns before the start of a 1 indexed line of the text */
  columnsBefore: (line: number) => number;
};

/** For text that is the whole file */
export const NO_OFFSET: Offset = { lines: 0, columnsBefore: () => 0 };

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
