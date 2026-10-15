import { parseSync } from "oxc-parser";
import { CodeBlock, parseCodeFences } from "./blocks.ts";
import type { Position } from "./compile-error.ts";

/** Whether a doc is a source file, whose JSDoc comments hold the code fences */
export function isSourceFile(path: string): boolean {
  return /\.[cm]?[jt]sx?$/.test(path);
}

/** The `/*` opening a comment, which oxc leaves out of the comment's `value` */
const COMMENT_OPEN_LENGTH = "/*".length;

/** The indent, `*` and one space or tab starting each line of a JSDoc comment */
const LINE_PREFIX = /^\s*\*?[ \t]?/;

/**
 * Code fences in a source file's JSDoc comments (`/** … *\/`). Each comment is read as markdown
 * with its ` * ` line prefixes removed, then fences move back to their place in the file.
 */
export function parseJsDocFences(source: string, path: string): CodeBlock[] {
  // most source files have no fences, so skip parsing them
  if (!/```|~~~/.test(source)) return [];
  return parseSync(path, source)
    .comments.filter(({ type, value }) => type === "Block" && value.startsWith("*"))
    .flatMap(({ start, value }) => {
      const before = source.slice(0, start);
      const lineStart = before.lastIndexOf("\n") + 1;
      const commentLine = before.split("\n").length - 1;
      const lines = value.split("\n");
      const prefixLengths = lines.map((line) => LINE_PREFIX.exec(line)?.[0].length ?? 0);
      // file columns before each line's markdown; only the first line also has the text before the comment
      const markdownColumns = prefixLengths.map(
        (length, i) => length + (i === 0 ? start - lineStart + COMMENT_OPEN_LENGTH : 0),
      );
      const markdown = lines.map((line, i) => line.slice(prefixLengths[i])).join("\n");
      return parseCodeFences(markdown, path).map((block) =>
        moved(block, commentLine, markdownColumns),
      );
    });
}

/**
 * Moves a fence from its comment's markdown to the file. `markdownColumns[i]` is how many file
 * columns precede markdown line `i + 1`, and `lineOffset` is how many file lines precede the comment.
 */
function moved(
  block: CodeBlock,
  lineOffset: number,
  markdownColumns: readonly number[],
): CodeBlock {
  const { contents, lang, annotation, file, range, indent } = block.details;
  const columnsBefore = (markdownLine: number): number => markdownColumns[markdownLine - 1] ?? 0;
  const move = ({ line, column }: Position): Position => ({
    line: line + lineOffset,
    column: column + columnsBefore(line),
  });
  const openingLine = block.line;
  const firstCodeLine = openingLine + 1;
  return new CodeBlock({
    code: contents,
    lang,
    annotation,
    path: file,
    range: { start: move(range.start), end: move(range.end) },
    indent: indent + columnsBefore(openingLine),
    // remark strips the fence's indent from each code line, so it is added back along with the prefix
    lineIndents: contents.split("\n").map((_, i) => indent + columnsBefore(firstCodeLine + i)),
  });
}
