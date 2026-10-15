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

/** How many lines come before `offset` in `source` */
function linesBefore(source: string, offset: number): number {
  return source.slice(0, offset).split("\n").length - 1;
}

/** How many characters come before `offset` on its own line */
function columnsBefore(source: string, offset: number): number {
  const lineStart = source.lastIndexOf("\n", offset - 1) + 1;
  return offset - lineStart;
}

/** A comment read as markdown, and where each of its markdown lines sits in the file */
type CommentMarkdown = {
  markdown: string;
  /** File lines before the comment */
  linesBefore: number;
  /** File columns before the text of a 1 indexed markdown line */
  columnsBefore: (markdownLine: number) => number;
};

function commentMarkdown(source: string, start: number, value: string): CommentMarkdown {
  const lines = value.split("\n");
  const prefixLengths = lines.map((line) => LINE_PREFIX.exec(line)?.[0].length ?? 0);
  // only the first line also has the file text before the comment, and the comment's own `/*`
  const firstLineStart = columnsBefore(source, start) + COMMENT_OPEN_LENGTH;
  const columns = prefixLengths.map((length, i) => (i === 0 ? firstLineStart + length : length));
  return {
    markdown: lines.map((line, i) => line.slice(prefixLengths[i])).join("\n"),
    linesBefore: linesBefore(source, start),
    columnsBefore: (markdownLine) => columns[markdownLine - 1] ?? 0,
  };
}

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
      const comment = commentMarkdown(source, start, value);
      return parseCodeFences(comment.markdown, path).map((block) => moved(block, comment));
    });
}

/** Moves a fence from its comment's markdown to its place in the file */
function moved(block: CodeBlock, comment: CommentMarkdown): CodeBlock {
  const { contents, lang, annotation, file, range, indent } = block.details;
  const fileLine = (markdownLine: number): number => comment.linesBefore + markdownLine;
  const move = ({ line, column }: Position): Position => ({
    line: fileLine(line),
    column: column + comment.columnsBefore(line),
  });
  // remark strips the fence's own indent from every code line, so each line adds it back
  const indentOfMarkdownLine = (markdownLine: number): number =>
    indent + comment.columnsBefore(markdownLine);
  const codeStartLine = block.line + 1;
  return new CodeBlock({
    code: contents,
    lang,
    annotation,
    path: file,
    range: { start: move(range.start), end: move(range.end) },
    indent: indentOfMarkdownLine(block.line),
    lineIndents: contents.split("\n").map((_, i) => indentOfMarkdownLine(codeStartLine + i)),
  });
}
