import { parseSync } from "oxc-parser";
import { parseCodeFences, type CodeBlock } from "./blocks.ts";
import { columnsBefore, linesBefore, type Offset } from "./offset.ts";

/** The `/*` opening a comment, which oxc leaves out of the comment's `value` */
const COMMENT_OPEN_LENGTH = "/*".length;

/** The indent, `*` and one space or tab starting each line of a JSDoc comment */
const LINE_PREFIX = /^\s*\*?[ \t]?/;

/** A comment read as markdown, and where that markdown sits in the file */
function commentMarkdown(
  source: string,
  start: number,
  value: string,
): { markdown: string; offset: Offset } {
  const lines = value.split("\n");
  const prefixLengths = lines.map((line) => LINE_PREFIX.exec(line)?.[0].length ?? 0);
  // only the first line also has the file text before the comment, and the comment's own `/*`
  const firstLineStart = columnsBefore(source, start) + COMMENT_OPEN_LENGTH;
  const columns = prefixLengths.map((length, i) => (i === 0 ? firstLineStart + length : length));
  return {
    markdown: lines.map((line, i) => line.slice(prefixLengths[i])).join("\n"),
    offset: {
      lines: linesBefore(source, start),
      columnsBefore: (line) => columns[line - 1] ?? 0,
    },
  };
}

/**
 * Code fences in a source file's JSDoc comments (`/** … *\/`). Each comment is read as markdown
 * with its ` * ` line prefixes removed, then the fences are placed back in the file.
 */
export function parseJsDocFences(source: string, path: string): CodeBlock[] {
  // most source files have no fences, so skip parsing them
  if (!/```|~~~/.test(source)) return [];
  return parseSync(path, source)
    .comments.filter(({ type, value }) => type === "Block" && value.startsWith("*"))
    .flatMap(({ start, value }) => {
      const { markdown, offset } = commentMarkdown(source, start, value);
      return parseCodeFences(markdown, path, offset);
    });
}
