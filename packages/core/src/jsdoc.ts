import { parseSync } from "oxc-parser";
import { CodeBlock, parseCodeFences } from "./blocks.ts";
import type { Logger } from "./logger.ts";

/** Whether a doc is a source file, whose JSDoc comments hold the code fences */
export function isSourceFile(path: string): boolean {
  return /\.[cm]?[jt]sx?$/.test(path);
}

/**
 * Code fences in a source file's JSDoc comments (`/** … *\/`). Each comment is read as markdown
 * with its ` * ` line prefixes removed, then fences move back to their place in the file.
 */
export function parseJsDocFences(source: string, path: string, log: Logger): CodeBlock[] {
  return parseSync(path, source)
    .comments.filter(({ type, value }) => type === "Block" && value.startsWith("*"))
    .flatMap(({ start, value }) => {
      const lines = value
        .split("\n")
        .map((line) => /^(\s*\*? ?)(.*)$/.exec(line) ?? ["", "", line]);
      const markdown = lines.map(([, , text]) => text).join("\n");
      const commentLine = source.slice(0, start).split("\n").length - 1;
      return parseCodeFences(markdown, path, log).map((block) => {
        const prefix = lines[block.line - 1]?.[1]?.length ?? 0;
        return moved(block, commentLine, prefix);
      });
    });
}

function moved(block: CodeBlock, lines: number, columns: number): CodeBlock {
  const { contents, lang, annotation, file, range, indent } = block.details;
  const move = ({ line, column }: { line: number; column: number }) => ({
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
