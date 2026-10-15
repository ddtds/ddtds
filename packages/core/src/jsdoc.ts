import { parseSync } from "oxc-parser";
import { CodeBlock, parseCodeFences } from "./blocks.ts";
import type { Position } from "./compile-error.ts";

/** Whether a doc is a source file, whose JSDoc comments hold the code fences */
export function isSourceFile(path: string): boolean {
  return /\.[cm]?[jt]sx?$/.test(path);
}

/** The ` * ` starting each line of a JSDoc comment */
const linePrefix = /^\s*\*? ?/;

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
      const lines = value.split("\n");
      // the first line starts after the comment's `/*`, which is not part of `value`
      const before = source.slice(0, start);
      const firstColumn = start - (before.lastIndexOf("\n") + 1) + 2;
      const cuts = lines.map((line) => linePrefix.exec(line)?.[0].length ?? 0);
      const prefixes = cuts.map((cut, i) => cut + (i === 0 ? firstColumn : 0));
      const markdown = lines.map((line, i) => line.slice(cuts[i])).join("\n");
      const commentLine = before.split("\n").length - 1;
      return parseCodeFences(markdown, path).map((block) => moved(block, commentLine, prefixes));
    });
}

/** Moves a fence from its comment's markdown to the file; `prefixes` is each line's columns before the markdown */
function moved(block: CodeBlock, lines: number, prefixes: readonly number[]): CodeBlock {
  const { contents, lang, annotation, file, range, indent } = block.details;
  const prefix = (line: number): number => prefixes[line - 1] ?? 0;
  const move = ({ line, column }: Position): Position => ({
    line: line + lines,
    column: column + prefix(line),
  });
  const first = block.line;
  return new CodeBlock({
    code: contents,
    lang,
    annotation,
    path: file,
    range: { start: move(range.start), end: move(range.end) },
    indent: indent + prefix(first),
    // code starts on the line after the fence; remark also strips the fence's indent from each
    lineIndents: contents.split("\n").map((_, i) => indent + prefix(first + 1 + i)),
  });
}
