import { parseSync } from "oxc-parser";
import { CodeBlock, parseCodeFences } from "./blocks.ts";
import type { Position } from "./compile-error.ts";
import type { Logger } from "./logger.ts";

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
export function parseJsDocFences(source: string, path: string, log: Logger): CodeBlock[] {
  return parseSync(path, source)
    .comments.filter(({ type, value }) => type === "Block" && value.startsWith("*"))
    .flatMap(({ start, value }) => {
      const lines = value.split("\n");
      const prefixes = lines.map((line) => linePrefix.exec(line)?.[0].length ?? 0);
      const markdown = lines.map((line, i) => line.slice(prefixes[i])).join("\n");
      const commentLine = source.slice(0, start).split("\n").length - 1;
      return parseCodeFences(markdown, path, log).map((block) =>
        moved(block, commentLine, prefixes[block.line - 1] ?? 0),
      );
    });
}

function moved(block: CodeBlock, lines: number, columns: number): CodeBlock {
  const { contents, lang, annotation, file, range, indent } = block.details;
  const move = ({ line, column }: Position): Position => ({
    line: line + lines,
    column: column + columns,
  });
  return new CodeBlock({
    code: contents,
    lang,
    annotation,
    path: file,
    range: { start: move(range.start), end: move(range.end) },
    indent: indent + columns,
  });
}
